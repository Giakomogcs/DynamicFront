#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting DynamicFront Development Environment...${NC}"

# Check if Docker is running
echo -e "${YELLOW}🔍 Checking Docker status...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running is accessible.${NC}"
    echo -e "${YELLOW}🔄 Attempting to start Docker...${NC}"
    open -a Docker
    echo -e "Waiting for Docker to start..."
    while ! docker info > /dev/null 2>&1; do
        sleep 1
        echo -n "."
    done
    echo ""
fi
echo -e "${GREEN}✅ Docker is running.${NC}"

# Check for .env files
if [ ! -f "server/.env" ]; then
    echo -e "${RED}❌ Missing server/.env file. Please create it.${NC}"
    exit 1
fi
# Client .env usually checked by vite, but good to check existence if critical
if [ ! -f "client/.env" ]; then
    echo -e "${YELLOW}⚠️  Missing client/.env file. Proceeding, but client might misbehave.${NC}"
fi

# Start Database
echo -e "${YELLOW}🐘 Starting Database container...${NC}"
docker compose up -d
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start database container.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database container started.${NC}"

# Run Database Setup
echo -e "${YELLOW}🔄 Running Database setup (Generate, Migrate, Seed)...${NC}"
echo -e "${BLUE}  Running: npm run generate${NC}"
npm run generate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Prisma Generate failed.${NC}"
    exit 1
fi

echo -e "${BLUE}  Running: npm run migrate${NC}"
npm run migrate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Prisma Migrate failed.${NC}"
    exit 1
fi

echo -e "${BLUE}  Running: npm run db:seed${NC}"
npm run db:seed
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Database seeding failed or nothing to seed. Continuing...${NC}"
    # Not fatal often
fi
echo -e "${GREEN}✅ Database setup complete.${NC}"

# Start Application
echo -e "${BLUE}🚀 Starting Client and Server...${NC}"
npx concurrently "npm run api --workspace=server" "npm run dev --workspace=client" --names "SERVER,CLIENT" --prefix-colors "blue,magenta"
