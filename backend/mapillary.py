import logging
import math
import os

import requests

logger = logging.getLogger("rainbolt")


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def get_mapillary_images(lat: float, lon: float, radius: float = 0.003, limit: int = 5) -> list:

    api_key = os.getenv("MAPILLARY_API_KEY")
    if not api_key:
        raise ValueError("MAPILLARY_API_KEY environment variable not set")

    url = "https://graph.mapillary.com/images"

    params = {
        "access_token": api_key,
        "fields": "id,thumb_1024_url,geometry",
        "bbox": f"{lon-radius},{lat-radius},{lon+radius},{lat+radius}",
        "limit": 50  # Fetch more images to filter from
    }

    response = requests.get(url, params=params, timeout=10)
    if response.status_code == 200:
        all_data = response.json()
        data = all_data.get('data', [])

        # Calculate distance for each image and sort by proximity
        images_with_distance = []
        for img in data:
            if img.get('thumb_1024_url') and img.get('geometry'):
                coords = img['geometry']['coordinates']
                img_lon, img_lat = coords[0], coords[1]
                distance = haversine_distance(lat, lon, img_lat, img_lon)
                images_with_distance.append({
                    'url': img['thumb_1024_url'],
                    'distance': distance,
                    'lat': img_lat,
                    'lon': img_lon
                })

        # Sort by distance and return the closest ones
        images_with_distance.sort(key=lambda x: x['distance'])

        if not images_with_distance:
            logger.info("No Mapillary images matched the requested area")
            return []

        closest = images_with_distance[0]
        logger.info(
            f"closest image at {closest['distance']:.2f} meters, "
            f"coordinates: ({closest['lat']}, {closest['lon']})"
        )

        return [img['url'] for img in images_with_distance[:limit]]

    else:
        logger.error(f"Error fetching Mapillary images: {response.status_code}")
        return []

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()  
    # Eiffel Tower coordinates: 48.8584° N, 2.2945° E
    images = get_mapillary_images(48.858093, 2.294694, radius=0.001, limit=5)
    print(f"Found {len(images)} images")
    for i, url in enumerate(images, 1):
        print(f"{i}. {url}")