from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import base64
import tempfile
import httpx
import json
from datetime import date, datetime
from typing import Optional
from google import genai

load_dotenv()

app = FastAPI(title="TigerPlate API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Clemson MyDiningHub GraphQL Scraper ───────────────────────────

GRAPHQL_URL = "https://api.elevate-dxp.com/api/mesh/c087f756-cc72-4649-a36f-3a41b700c519/graphql"

GRAPHQL_HEADERS = {
    "accept": "application/graphql-response+json,application/json;q=0.9",
    "content-type": "application/json",
    "aem-elevate-clientpath": "ch/clemson/en",
    "magento-customer-group": "b6589fc6ab0dc82cf12099d1c2d40ab994e8410c",
    "magento-store-code": "ch_clemson",
    "magento-store-view-code": "ch_clemson_en",
    "magento-website-code": "ch_clemson",
    "store": "ch_clemson_en",
    "x-api-key": "ElevateAPIProd",
    "origin": "https://clemson.mydininghub.com",
    "referer": "https://clemson.mydininghub.com/",
}

LOCATIONS = {
    "schilletter": "schilletter-dining-hall",
    "douthit": "community-hub",
    "mcalister": "the-dish-at-mcalister",
}

# Meal period IDs (from the site)
MEAL_PERIODS = {
    "breakfast": 23,
    "lunch": 24,
    "dinner": 25,
}

GRAPHQL_QUERY = """query getLocationRecipes($campusUrlKey:String!$locationUrlKey:String!$date:String!$mealPeriod:Int$viewType:Commerce_MenuViewType!){getLocationRecipes(campusUrlKey:$campusUrlKey locationUrlKey:$locationUrlKey date:$date mealPeriod:$mealPeriod viewType:$viewType){locationRecipesMap{skus stationSkuMap{id skus __typename}dateSkuMap{date stations{id skus{simple configurable{sku variants __typename}__typename}__typename}__typename}__typename}products{items{id name sku images{label roles url __typename}attributes{name value __typename}...on Catalog_SimpleProductView{price{final{amount{currency value __typename}__typename}__typename}__typename}...on Catalog_ComplexProductView{options{title values{id title ...on Catalog_ProductViewOptionValueProduct{product{name sku attributes{name value __typename}price{final{amount{value currency __typename}__typename}__typename}__typename}__typename}__typename}__typename}__typename}__typename}__typename}}}"""

# Station name mapping (from Clemson's site structure)
STATION_NAMES = {
    # Schilletter
    1501: "Destination Station",
    1504: "Salad Bar",
    1507: "The Grill",
    1510: "Deli",
    1513: "Pizza",
    1516: "True Balance",
    1519: "Home Zone",
    1522: "Mongolian Grill",
    1525: "Soups",
    1528: "Desserts",
    1531: "Clean Eats",
    1534: "Salad Bar",
    # Douthit Hills (Community Hub)
    1755: "Smokehouse",
    1758: "Burgers",
    1761: "Chopped Salad",
    1764: "Fusion Cafe",
    1767: "Bento Sushi",
    1770: "Grill & Deli",
    1773: "Pies & Wedgies",
    1776: "Salad Bar",
    1779: "Soups",
    1782: "Desserts",
    # McAlister (The Dish)
    501: "Salad Bar",
    504: "Nutrition Calculator",
    522: "Sushi",
    534: "Pasta",
    537: "Vegan",
    696: "Homeline",
    699: "The Grill",
    1094: "Gluten Solutions",
}


def extract_attr(attributes: list, name: str) -> Optional[str]:
    """Extract a named attribute from the product attributes list."""
    for attr in attributes:
        if attr.get("name") == name:
            return attr.get("value")
    return None


def parse_product(item: dict, hall: str, meal: str, station_id: int = None) -> Optional[dict]:
    """Parse a single product from the GraphQL response into a clean meal dict."""
    attrs = item.get("attributes", [])
    
    name = extract_attr(attrs, "marketing_name") or item.get("name", "")
    calories_raw = extract_attr(attrs, "calories")
    protein_raw = extract_attr(attrs, "protein")
    carbs_raw = extract_attr(attrs, "total_carbohydrates")
    fat_raw = extract_attr(attrs, "total_fat")
    
    # Skip items without nutrition data or that are hidden
    if not calories_raw:
        return None
    
    is_hidden = extract_attr(attrs, "is_hide_from_web_menu")
    if is_hidden == "yes":
        return None
    
    ingredient_item = extract_attr(attrs, "ingredient_item")
    if ingredient_item == "yes":
        return None

    try:
        calories = round(float(calories_raw))
        protein = round(float(protein_raw)) if protein_raw else 0
        carbs = round(float(carbs_raw)) if carbs_raw else 0
        fat = round(float(fat_raw)) if fat_raw else 0
    except (ValueError, TypeError):
        return None

    # Skip items with 0 calories (condiments, water, etc.)
    if calories < 5:
        return None

    description = extract_attr(attrs, "marketing_description") or ""
    serving = extract_attr(attrs, "serving_combined") or ""
    ingredients = extract_attr(attrs, "recipe_ingredients") or ""
    allergens = extract_attr(attrs, "allergen_statement") or ""
    sodium = extract_attr(attrs, "sodium")
    fiber = extract_attr(attrs, "dietary_fiber")
    sugar = extract_attr(attrs, "sugars")
    sat_fat = extract_attr(attrs, "saturated_fat")
    cholesterol = extract_attr(attrs, "cholesterol")
    
    station_name = STATION_NAMES.get(station_id, "Other") if station_id else "Other"

    return {
        "item_name": name.strip(),
        "description": description.strip(),
        "hall": hall,
        "meal": meal,
        "station": station_name,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "sodium": round(float(sodium)) if sodium else None,
        "fiber": round(float(fiber), 1) if fiber else None,
        "sugar": round(float(sugar), 1) if sugar else None,
        "saturated_fat": round(float(sat_fat), 1) if sat_fat else None,
        "cholesterol": round(float(cholesterol)) if cholesterol else None,
        "serving": serving.strip(),
        "ingredients": ingredients.strip(),
        "allergens": allergens.strip(),
        "sku": item.get("sku", ""),
    }


async def fetch_menu(location_key: str, location_url: str, meal_name: str, meal_period: int, target_date: str) -> list:
    """Fetch menu items for a specific location/meal/date from the GraphQL API."""
    variables = {
        "campusUrlKey": "campus",
        "locationUrlKey": location_url,
        "date": target_date,
        "mealPeriod": meal_period,
        "viewType": "DAILY",
    }
    
    params = {
        "query": GRAPHQL_QUERY,
        "operationName": "getLocationRecipes",
        "variables": json.dumps(variables),
        "extensions": json.dumps({"clientLibrary": {"name": "@apollo/client", "version": "4.1.6"}}),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(GRAPHQL_URL, params=params, headers=GRAPHQL_HEADERS)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"Error fetching {location_key}/{meal_name}: {e}")
        return []

    recipes = data.get("data", {}).get("getLocationRecipes", {})
    if not recipes:
        return []
    
    loc_map = recipes.get("locationRecipesMap", {})
    products_data = recipes.get("products")
    if not products_data:
        return []
    products = products_data.get("items", [])
    
    # Build SKU -> station mapping
    sku_station = {}
    for station in loc_map.get("stationSkuMap", []):
        sid = station["id"]
        for sku in station.get("skus", []):
            sku_station[sku] = sid

    # Build set of SKUs that are actually on today's menu
    today_skus = set()
    date_sku_maps = loc_map.get("dateSkuMap", [])
    for dsm in date_sku_maps:
        if dsm.get("date") == target_date:
            for station in dsm.get("stations", []):
                for sku in station.get("skus", {}).get("simple", []):
                    today_skus.add(sku)
                for cfg in station.get("skus", {}).get("configurable", []):
                    for v in cfg.get("variants", []):
                        today_skus.add(v)

    # Parse products
    meals = []
    seen_names = set()
    
    hall_display = {
        "schilletter": "Schilletter",
        "core": "Core",
        "douthit": "Douthit Hills",
        "mcalister": "McAlister",
    }.get(location_key, location_key)

    for item in products:
        sku = item.get("sku", "")
        
        # Only include items on today's menu
        if sku not in today_skus:
            continue
        
        station_id = sku_station.get(sku)
        parsed = parse_product(item, hall_display, meal_name, station_id)
        
        if parsed and parsed["item_name"].lower() not in seen_names:
            seen_names.add(parsed["item_name"].lower())
            meals.append(parsed)

    return meals


# ─── Menu Cache ────────────────────────────────────────────────────

menu_cache = {"date": None, "meals": []}


async def get_todays_menu(force_refresh: bool = False) -> list:
    """Get today's menu, fetching from API if not cached."""
    today = date.today().isoformat()
    
    if not force_refresh and menu_cache["date"] == today and menu_cache["meals"]:
        return menu_cache["meals"]

    print(f"Fetching live menu for {today}...")
    all_meals = []

    for loc_key, loc_url in LOCATIONS.items():
        for meal_name, meal_period in MEAL_PERIODS.items():
            items = await fetch_menu(loc_key, loc_url, meal_name, meal_period, today)
            all_meals.extend(items)
            print(f"  {loc_key}/{meal_name}: {len(items)} items")

    menu_cache["date"] = today
    menu_cache["meals"] = all_meals
    print(f"Total: {len(all_meals)} menu items loaded")
    return all_meals


# ─── Synonym matching for AI scan ─────────────────────────────────

SYNONYMS = {
    "hamburger": ["burger", "cheeseburger"],
    "burger": ["hamburger", "cheeseburger"],
    "fries": ["french fries", "potato fries"],
    "chicken sandwich": ["chicken burger"],
    "salad": ["garden salad", "side salad"],
    "pasta": ["spaghetti", "penne", "noodles"],
    "rice": ["steamed rice", "white rice"],
    "pizza": ["cheese pizza", "pepperoni pizza"],
    "soup": ["broth", "chowder", "stew"],
    "wrap": ["burrito", "tortilla"],
}


def find_best_match(detected_food: str, meals: list) -> Optional[dict]:
    detected_lower = detected_food.lower().strip().replace("the ", "").replace("a ", "").replace("an ", "")

    search_terms = [detected_lower]
    for key, vals in SYNONYMS.items():
        if key in detected_lower:
            search_terms.extend(vals)
        for v in vals:
            if v in detected_lower:
                search_terms.append(key)

    # Exact match
    for m in meals:
        if m["item_name"].lower() == detected_lower:
            return m

    best_match = None
    best_score = 0

    for m in meals:
        item_name = m["item_name"].lower()
        score = 0

        for term in search_terms:
            if term in item_name:
                score = max(score, 100)
            elif item_name in term:
                score = max(score, 90)

        words = detected_lower.split()
        for word in words:
            if len(word) > 2 and word in item_name:
                score += 20

        if score > best_score and score >= 20:
            best_score = score
            best_match = m

    return best_match


# ─── API Endpoints ─────────────────────────────────────────────────

@app.get("/")
async def root():
    meals = await get_todays_menu()
    return {
        "message": "TigerPlate API",
        "version": "2.0.0",
        "date": date.today().isoformat(),
        "meals_loaded": len(meals),
        "live_data": True,
    }


@app.get("/halls")
async def get_halls():
    meals = await get_todays_menu()
    halls = list(set(m["hall"] for m in meals))
    return {"halls": sorted(halls)}


@app.get("/meals")
async def get_meals(
    hall: Optional[str] = Query(None),
    meal: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    station: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    limit: int = Query(100),
):
    all_meals = await get_todays_menu()
    filtered = all_meals

    if hall:
        filtered = [m for m in filtered if m["hall"].lower() == hall.lower()]
    if meal:
        filtered = [m for m in filtered if m["meal"].lower() == meal.lower()]
    if station:
        filtered = [m for m in filtered if m["station"].lower() == station.lower()]
    if search:
        s = search.lower()
        filtered = [m for m in filtered if s in m["item_name"].lower() or s in m.get("description", "").lower()]
    if sort_by and sort_by in ["calories", "protein", "carbs", "fat"]:
        filtered = sorted(filtered, key=lambda x: x.get(sort_by, 0))

    return {"count": len(filtered[:limit]), "meals": filtered[:limit]}


@app.get("/meals/healthier")
async def get_healthier(
    item_name: str = Query(...),
    limit: int = Query(5),
):
    all_meals = await get_todays_menu()
    current = next((m for m in all_meals if m["item_name"].lower() == item_name.lower()), None)
    
    if not current:
        return {"error": "Meal not found", "alternatives": []}

    same_hall = [m for m in all_meals
                 if m["hall"].lower() == current["hall"].lower()
                 and m["meal"].lower() == current["meal"].lower()
                 and m["item_name"].lower() != item_name.lower()
                 and m["calories"] < current["calories"]]
    
    same_hall.sort(key=lambda x: x["calories"], reverse=True)

    return {
        "current": current,
        "alternatives": same_hall[:limit],
    }


@app.get("/stations")
async def get_stations():
    meals = await get_todays_menu()
    stations = list(set(m["station"] for m in meals))
    return {"stations": sorted(stations)}


@app.get("/stats")
async def get_stats():
    meals = await get_todays_menu()
    if not meals:
        return {"total_items": 0, "halls": 0, "error": "No menu data available"}
    
    return {
        "total_items": len(meals),
        "halls": len(set(m["hall"] for m in meals)),
        "date": date.today().isoformat(),
        "avg_calories": round(sum(m["calories"] for m in meals) / len(meals), 1),
        "avg_protein": round(sum(m["protein"] for m in meals) / len(meals), 1),
        "highest_protein": max(meals, key=lambda x: x["protein"]),
        "lowest_calorie": min(meals, key=lambda x: x["calories"]),
        "live_data": True,
    }


@app.post("/meals/identify")
async def identify_meal(image: UploadFile = File(...)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "API key not configured"}
    
    client = genai.Client(api_key=api_key)
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            content = await image.read()
            tmp.write(content)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {"inline_data": {"mime_type": "image/jpeg", "data": image_data}},
                "Identify the food in this image. Return ONLY the simple food name in 1-2 words lowercase. Examples: cheeseburger, fried chicken, caesar salad, spaghetti. Never describe ingredients or toppings. Just the name."
            ]
        )
        detected = response.text.strip().lower()
        os.unlink(tmp_path)

        all_meals = await get_todays_menu()
        match = find_best_match(detected, all_meals)

        return {"detected": detected, "matched": match is not None, "meal": match}
    except Exception as e:
        return {"error": str(e)}


class ChatRequest(BaseModel):
    message: str
    context: str = ""


@app.post("/chat")
async def chat(req: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"response": "API not configured"}
    
    client = genai.Client(api_key=api_key)
    
    try:
        all_meals = await get_todays_menu()
        ctx = "\n".join(
            f"{m['item_name']} ({m['hall']}, {m['meal']}, {m['station']}): {m['calories']} cal, {m['protein']}g protein, {m['carbs']}g carbs, {m['fat']}g fat"
            for m in all_meals[:60]
        )

        prompt = f"""You're a Clemson student who's super into fitness and nutrition — think of yourself as that one friend who always knows what's good at the dining hall and actually cares about eating well. You go by "Tiger" and you text like a real college student — casual, sometimes use slang, keep it real, use lowercase when it feels natural. No corporate speak, no bullet points, no "Great question!" energy.

You know every item being served right now at Clemson's dining halls. Here's today's full menu:
{ctx}

RULES:
- Talk like you're texting a friend, not writing a report
- Reference SPECIFIC items from today's menu above — use real names and real numbers
- Keep responses short (2-4 sentences max) unless they want detail
- If someone asks about macros, give actual numbers from the menu
- Be honest — if something is mid nutritionally, say so
- Hype up the genuinely good options
- Use emojis sparingly (1-2 max per message, not every message)
- Never say "I'm an AI" or "as a nutritionist" — you're just a knowledgeable friend
- If they ask about something not on today's menu, tell them straight up

The homie says: {req.message}"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt]
        )
        return {"response": response.text.strip()}
    except Exception as e:
        return {"response": "Having trouble connecting — try again in a moment!"}


@app.get("/refresh")
async def refresh_menu():
    """Force refresh the menu cache."""
    meals = await get_todays_menu(force_refresh=True)
    return {"refreshed": True, "date": date.today().isoformat(), "total_items": len(meals)}
