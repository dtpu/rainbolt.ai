from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import logger
from mapillary import get_mapillary_images
from security import require_allowed_origin

router = APIRouter()


class MapillaryRequest(BaseModel):
    latitude: float
    longitude: float
    radius: float = 0.003
    limit: int = 5


@router.post("/api/mapillary-images")
async def get_mapillary_images_endpoint(request: MapillaryRequest, _: None = Depends(require_allowed_origin)):
    """
    Fetch Mapillary street view images for given coordinates
    """
    try:
        images = get_mapillary_images(
            lat=request.latitude,
            lon=request.longitude,
            radius=request.radius,
            limit=request.limit
        )
        return {
            "success": True,
            "images": images,
            "count": len(images)
        }
    except Exception as e:
        logger.error(f"Error fetching Mapillary images: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching Mapillary images: {str(e)}")
