from django.shortcuts import render
from rest_framework import generics 
from rest_framework.permissions import IsAuthenticated

from .models import Salon
from .serializers import SalonSerializer

class IsOwner(IsAuthenticated):
    def has_permission(self,request,view):
        authenticated = super().has_permission(request,view)

        return (
            authenticated
            and request.user.role =="OWNER"
        )

class SalonCreateView(generics.CreateAPIView):
    serializer_class = SalonSerializer
    permission_class = [IsOwner]

    def perform_create(self,serializer):
        serializer.save(
            owner=self.request.user,
            approval_status=Salon.ApprovalStatus.PENDING
        )