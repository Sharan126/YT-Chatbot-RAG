# Step 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Step 2: Production Python Backend Container
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY Backend/requirements.txt ./Backend/requirements.txt
RUN pip install --no-cache-dir -r ./Backend/requirements.txt

# Copy Backend code and built frontend bundle
COPY Backend/ ./Backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV PORT=10000
EXPOSE 10000
WORKDIR /app/Backend

CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]


