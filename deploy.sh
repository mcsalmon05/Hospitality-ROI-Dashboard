#!/bin/bash

# --- Google Cloud Run Deployment Script ---
PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="hospitality-roi-dashboard"
REGION="us-central1"

echo "🚀 Preparing to launch $SERVICE_NAME to Google Cloud..."

# 1. Build and push the container to Google Artifact Registry
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# 2. Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --port 3000

echo "✅ Deployment Complete!"
gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)'
