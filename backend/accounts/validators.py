import re
from rest_framework import serializers

def validate_name(value):
    if not re.match(r"^[A-Za-z ]+$", value):
        raise serializers.ValidationError(
            "Name can contain only letters and spaces."
        )
    return value