# Persistent Scheduling System Guide

## Overview

The PixelPim backend now features a robust, persistent scheduling system for CSV imports that addresses the limitations of the previous in-memory solution. This system ensures that scheduled imports survive server restarts and provides comprehensive logging and monitoring capabilities.

## Key Features

### 1. **Database Persistence**
- All scheduling data is stored in PostgreSQL database
- Jobs survive server restarts and system failures
- Comprehensive audit trail for all scheduling activities

### 2. **User Authentication & Authorization**
- All scheduled imports are tied to specific users
- Users can only manage their own scheduled imports
- JWT-based authentication for all scheduling endpoints

### 3. **Comprehensive Logging**
- Detailed execution logs for every import run
- Error tracking and debugging information
- Performance metrics and statistics

### 4. **Advanced Job Management**
- Create, update, pause, resume, cancel, and delete scheduled imports
- Real-time status monitoring
- Execution history and statistics

## Database Schema

### ScheduledImport Table
```sql
- id: String (CUID) - Primary key
- name: String? - Optional human-readable name
- description: String? - Optional description
- cronExpression: String - Cron expression for scheduling
- csvUrl: String - URL of the CSV file to import
- status: String - Current status (pending, active, paused, cancelled)
- isActive: Boolean - Whether the job should be executed
- lastRun: DateTime? - Last execution time
- nextRun: DateTime? - Next scheduled execution time
- errorCount: Int - Number of failed executions
- successCount: Int - Number of successful executions
- userId: Int - Owner of the scheduled import
- createdAt: DateTime - Creation timestamp
- updatedAt: DateTime - Last update timestamp
```

### ImportExecutionLog Table
```sql
- id: Int - Primary key
- scheduledImportId: String - Foreign key to ScheduledImport
- status: String - Execution status (processing, completed, failed)
- startTime: DateTime - Execution start time
- endTime: DateTime? - Execution end time
- itemsProcessed: Int - Total items processed
- itemsImported: Int - Successfully imported items
- itemsFailed: Int - Failed items
- errorMessage: String? - Error message if failed
- errorDetails: JSON? - Detailed error information
- executionSummary: JSON? - Summary of execution results
- userId: Int - User who owns the scheduled import
- createdAt: DateTime - Creation timestamp
- updatedAt: DateTime - Last update timestamp
```

## API Endpoints

### Scheduling Operations

#### Create Scheduled Import
```http
POST /products/import/schedule
Content-Type: application/json
Authorization: Bearer <token>

{
  "cronExpression": "0 2 * * *",
  "csvUrl": "https://example.com/products.csv",
  "name": "Daily Product Import",
  "description": "Import products at 2 AM daily"
}
```

#### Update Scheduled Import
```http
PATCH /products/import/jobs/{jobId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "cronExpression": "0 3 * * *",
  "name": "Updated Import Job",
  "isActive": true
}
```

### Job Management

#### Get All Jobs
```http
GET /products/import/jobs?includeExecutions=true
Authorization: Bearer <token>
```

#### Get Specific Job
```http
GET /products/import/jobs/{jobId}
Authorization: Bearer <token>
```

#### Pause Job
```http
POST /products/import/jobs/{jobId}/pause
Authorization: Bearer <token>
```

#### Resume Job
```http
POST /products/import/jobs/{jobId}/resume
Authorization: Bearer <token>
```

#### Cancel Job
```http
DELETE /products/import/jobs/{jobId}
Authorization: Bearer <token>
```

#### Delete Job Permanently
```http
DELETE /products/import/jobs/{jobId}/delete
Authorization: Bearer <token>
```

### Monitoring & Logging

#### Get Execution Logs
```http
GET /products/import/jobs/{jobId}/executions?page=1&limit=20
Authorization: Bearer <token>
```

#### Get Execution Statistics
```http
GET /products/import/jobs/{jobId}/stats
Authorization: Bearer <token>
```

## Job Lifecycle

### 1. **Creation**
- Job is created with `pending` status
- Cron expression is validated
- Next run time is calculated
- Job is stored in database and cron scheduler

### 2. **Active State**
- Job status becomes `active`
- Cron job runs according to schedule
- Each execution creates an execution log entry

### 3. **Execution Process**
- Job status changes to `processing` during execution
- Execution log tracks detailed progress
- Results are recorded (success/failure counts)
- Next run time is updated

### 4. **Management Operations**
- **Pause**: Job becomes `paused`, cron job is stopped
- **Resume**: Job becomes `active`, cron job is restarted
- **Cancel**: Job becomes `cancelled`, cron job is stopped
- **Delete**: Job and all related logs are permanently removed

## Server Restart Behavior

### Automatic Recovery
When the server restarts, the `ImportSchedulerService`:

1. **Loads Active Jobs**: Retrieves all active scheduled imports from database
2. **Recreates Cron Jobs**: Rebuilds the in-memory cron job instances
3. **Updates Next Run Times**: Recalculates next execution times
4. **Starts Jobs**: Resumes normal scheduling operation

### Data Integrity
- All job data persists in database
- Execution history is preserved
- No scheduled imports are lost during restarts

## Error Handling & Logging

### Execution Logging
Every import execution is tracked with:
- Start and end times
- Items processed, imported, and failed
- Detailed error messages and stack traces
- Execution summaries with results

### Error Recovery
- Failed executions are logged but don't stop future runs
- Error counts are tracked for monitoring
- Detailed error information aids debugging

### Monitoring
- Real-time job status monitoring
- Execution statistics and performance metrics
- Historical execution data for trend analysis

## Security Features

### Authentication
- All endpoints require JWT authentication
- Users can only access their own scheduled imports
- Role-based access control (future enhancement)

### Data Isolation
- Complete user data isolation
- Execution logs are user-specific
- No cross-user data access possible

## Performance Considerations

### Database Optimization
- Indexed queries for fast retrieval
- Pagination for large execution log datasets
- Efficient foreign key relationships

### Memory Management
- In-memory cron jobs are lightweight
- Database connections are pooled
- Execution logs are paginated to prevent memory issues

### Scaling
- Horizontal scaling supported
- Database-backed persistence enables load balancing
- Stateless job execution

## Migration from Previous System

The new system is a complete replacement for the previous in-memory scheduler:

### Improvements
- ✅ Persistent storage in database
- ✅ Comprehensive execution logging
- ✅ User authentication and authorization
- ✅ Advanced job management (pause/resume/update)
- ✅ Server restart recovery
- ✅ Detailed error tracking
- ✅ Performance statistics

### Breaking Changes
- Job IDs are now CUID strings instead of UUIDs
- Additional required database tables
- New API endpoints for enhanced functionality
- Updated response formats with execution logs

## Best Practices

### Cron Expressions
- Use standard cron syntax (5 fields: minute hour day month weekday)
- Validate expressions before creating jobs
- Consider timezone implications
- Avoid overlapping executions for large imports

### Error Handling
- Monitor execution logs regularly
- Set up alerts for failed imports
- Review error patterns for system issues
- Implement retry mechanisms if needed

### Performance
- Limit concurrent import executions
- Monitor database performance with large datasets
- Use pagination for execution log queries
- Consider archiving old execution logs

## Future Enhancements

### Planned Features
- Email notifications for failed imports
- Webhook integration for external monitoring
- Advanced retry mechanisms with backoff
- Bulk job management operations
- Job templates and presets
- Dashboard for visual monitoring

### Monitoring Integration
- Integration with monitoring systems (Prometheus/Grafana)
- Custom metrics for job performance
- Alerting based on failure rates
- Trend analysis and reporting

This persistent scheduling system provides a robust, production-ready solution for managing CSV imports with full traceability, user isolation, and comprehensive error handling.