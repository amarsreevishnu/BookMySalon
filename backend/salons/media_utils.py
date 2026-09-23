import base64
import os
import uuid
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename


def save_image_to_media(image_data_or_file, subfolder="salons"):
    """
    Saves an uploaded file or Base64 string to Django MEDIA_ROOT,
    returning the clean web-accessible media path (e.g. '/media/salons/covers/xyz.jpg').
    
    If the input is already an external URL (http/https) or an existing media path,
    it returns it unchanged.
    """
    if not image_data_or_file:
        return ""

    # 1. Handle Django UploadedFile / File object
    if hasattr(image_data_or_file, "read"):
        orig_name = getattr(image_data_or_file, "name", "upload.jpg")
        base_name, ext = os.path.splitext(orig_name)
        ext = ext.lower() if ext else ".jpg"
        clean_base = get_valid_filename(base_name) or "img"
        unique_name = f"{clean_base}_{uuid.uuid4().hex[:8]}{ext}"
        relative_path = f"{subfolder.strip('/')}/{unique_name}"
        
        saved_name = default_storage.save(
            relative_path,
            ContentFile(image_data_or_file.read())
        )
        return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"

    # If it's a string
    if isinstance(image_data_or_file, str):
        image_str = image_data_or_file.strip()

        # 2. Existing web URL (e.g. Unsplash or Cloudinary)
        if image_str.startswith("http://") or image_str.startswith("https://"):
            return image_str

        # 3. Already a media path
        if image_str.startswith("/media/") or image_str.startswith("media/"):
            return f"/{image_str.lstrip('/')}"

        # 4. Base64 Data URL (e.g. "data:image/jpeg;base64,/9j/4AAQSkZJR...")
        if image_str.startswith("data:image/"):
            try:
                header, base64_payload = image_str.split(";base64,", 1)
                mime = header.replace("data:image/", "").lower()
                if "png" in mime:
                    ext = ".png"
                elif "webp" in mime:
                    ext = ".webp"
                elif "gif" in mime:
                    ext = ".gif"
                elif "svg" in mime:
                    ext = ".svg"
                else:
                    ext = ".jpg"

                file_bytes = base64.b64decode(base64_payload)
                unique_name = f"salon_{uuid.uuid4().hex[:12]}{ext}"
                relative_path = f"{subfolder.strip('/')}/{unique_name}"

                saved_name = default_storage.save(
                    relative_path,
                    ContentFile(file_bytes)
                )
                return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"
            except Exception as e:
                # If decoding fails, fallback to empty or raw
                print(f"[media_utils] Failed to decode base64 image: {e}")
                return ""

    return str(image_data_or_file)


def build_full_media_url(request, path):
    """
    Prepends the current domain/host to relative media paths.
    E.g. '/media/salons/covers/a.jpg' -> 'http://127.0.0.1:8000/media/salons/covers/a.jpg'
    """
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if request and path.startswith("/"):
        return request.build_absolute_uri(path)
    return path

