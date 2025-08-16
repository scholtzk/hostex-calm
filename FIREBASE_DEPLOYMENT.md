# Firebase Functions Deployment Guide

## Overview

The availability calendar feature requires Firebase Functions to be deployed. Currently, the application is using mock data for testing purposes.

## Deployment Steps

### 1. Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project configured
- Node.js 20+ installed

### 2. Install Dependencies

```bash
cd functions
npm install
```

### 3. Build Functions

```bash
npm run build
```

### 4. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific availability functions
firebase deploy --only functions:getCleanerAvailability,functions:updateCleanerAvailability,functions:createAvailabilityLinks,functions:getAvailabilityLink,functions:getAllAvailabilityLinks
```

### 5. Update Frontend

Once functions are deployed, update the `USE_MOCK_DATA` flag in `src/hooks/useAvailability.ts`:

```typescript
const USE_MOCK_DATA = false; // Change to false when functions are deployed
```

## Troubleshooting

### Common Issues

1. **Container Healthcheck Failed**
   - This usually means the function is not starting properly
   - Check the Firebase console logs for more details
   - Ensure all dependencies are installed

2. **CORS Errors**
   - Functions are not deployed or not accessible
   - Check the function URLs in the Firebase console
   - Verify the function names match the deployment

3. **Build Errors**
   - Check TypeScript compilation errors
   - Ensure all imports are correct
   - Verify the uuid package is installed

### Alternative Deployment

If the standard deployment fails, try:

1. **Deploy one function at a time**:
   ```bash
   firebase deploy --only functions:getCleanerAvailability
   firebase deploy --only functions:updateCleanerAvailability
   # ... continue with other functions
   ```

2. **Check function logs**:
   ```bash
   firebase functions:log
   ```

3. **Redeploy with force**:
   ```bash
   firebase deploy --only functions --force
   ```

## Function URLs

Once deployed, the functions will be available at:
- `https://us-central1-[PROJECT-ID].cloudfunctions.net/getCleanerAvailability`
- `https://us-central1-[PROJECT-ID].cloudfunctions.net/updateCleanerAvailability`
- `https://us-central1-[PROJECT-ID].cloudfunctions.net/createAvailabilityLinks`
- `https://us-central1-[PROJECT-ID].cloudfunctions.net/getAvailabilityLink`
- `https://us-central1-[PROJECT-ID].cloudfunctions.net/getAllAvailabilityLinks`

## Testing

1. **Test with mock data**: Visit `/test-availability` to test the calendar
2. **Test with real functions**: Once deployed, create links and test the full flow
3. **Mobile testing**: Test on actual mobile devices to verify the responsive design

## Production Considerations

1. **Security**: Add authentication to the functions
2. **Rate limiting**: Implement rate limiting for the API endpoints
3. **Error handling**: Add comprehensive error handling
4. **Monitoring**: Set up Firebase monitoring and alerts
5. **Backup**: Ensure Firestore data is backed up regularly 