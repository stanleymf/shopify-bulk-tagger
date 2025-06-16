import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Clock, 
  Calendar, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Activity
} from 'lucide-react';
import { scheduledJobsService, ScheduledJob } from '@/lib/scheduled-jobs';
import { shopifyAPI, ShopifyCustomerSegment } from '@/lib/shopify-api';

interface ScheduledJobFormData {
  name: string;
  segmentId: number;
  segmentName: string;
  operation: 'add' | 'remove';
  tags: string[];
  scheduleType: 'interval' | 'daily' | 'weekly' | 'monthly';
  intervalMinutes: number;
  dailyTime: string;
  weeklyDay: number;
  weeklyTime: string;
  monthlyDay: number;
  monthlyTime: string;
  timezone: string;
}

export function ScheduledJobs() {
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [segments, setSegments] = useState<ShopifyCustomerSegment[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState({
    totalJobs: 0,
    activeJobs: 0,
    nextRun: undefined as string | undefined,
    recentExecutions: 0
  });

  const [formData, setFormData] = useState<ScheduledJobFormData>({
    name: '',
    segmentId: 0,
    segmentName: '',
    operation: 'add',
    tags: [],
    scheduleType: 'daily',
    intervalMinutes: 60,
    dailyTime: '09:00',
    weeklyDay: 1, // Monday
    weeklyTime: '09:00',
    monthlyDay: 1,
    monthlyTime: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [tagsInput, setTagsInput] = useState('');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load segments
      if (shopifyAPI.isInitialized()) {
        const segmentData = await shopifyAPI.getCustomerSegments();
        setSegments(segmentData);
      }

      // Load scheduled jobs
      const jobs = scheduledJobsService.getScheduledJobs();
      setScheduledJobs(jobs);

      // Load scheduler status
      const status = scheduledJobsService.getSchedulerStatus();
      setSchedulerStatus(status);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleCreateJob = () => {
    setEditingJob(null);
    setFormData({
      name: '',
      segmentId: 0,
      segmentName: '',
      operation: 'add',
      tags: [],
      scheduleType: 'daily',
      intervalMinutes: 60,
      dailyTime: '09:00',
      weeklyDay: 1,
      weeklyTime: '09:00',
      monthlyDay: 1,
      monthlyTime: '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    setTagsInput('');
    setShowJobForm(true);
  };

  const handleEditJob = (job: ScheduledJob) => {
    setEditingJob(job);
    setFormData({
      name: job.name,
      segmentId: job.segmentId,
      segmentName: job.segmentName,
      operation: job.operation,
      tags: job.tags,
      scheduleType: job.schedule.type,
      intervalMinutes: job.schedule.intervalMinutes || 60,
      dailyTime: job.schedule.dailyTime || '09:00',
      weeklyDay: job.schedule.weeklyDay || 1,
      weeklyTime: job.schedule.weeklyTime || '09:00',
      monthlyDay: job.schedule.monthlyDay || 1,
      monthlyTime: job.schedule.monthlyTime || '09:00',
      timezone: job.timezone
    });
    setTagsInput(job.tags.join(', '));
    setShowJobForm(true);
  };

  const handleSaveJob = () => {
    if (!formData.name || !formData.segmentId || formData.tags.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    const schedule: any = {
      type: formData.scheduleType
    };

    switch (formData.scheduleType) {
      case 'interval':
        schedule.intervalMinutes = formData.intervalMinutes;
        break;
      case 'daily':
        schedule.dailyTime = formData.dailyTime;
        break;
      case 'weekly':
        schedule.weeklyDay = formData.weeklyDay;
        schedule.weeklyTime = formData.weeklyTime;
        break;
      case 'monthly':
        schedule.monthlyDay = formData.monthlyDay;
        schedule.monthlyTime = formData.monthlyTime;
        break;
    }

    const jobData = {
      name: formData.name,
      isActive: true,
      segmentId: formData.segmentId,
      segmentName: formData.segmentName,
      operation: formData.operation,
      tags: formData.tags,
      schedule,
      timezone: formData.timezone
    };

    if (editingJob) {
      scheduledJobsService.updateScheduledJob(editingJob.id, jobData);
    } else {
      scheduledJobsService.addScheduledJob(jobData);
    }

    setShowJobForm(false);
    loadData();
  };

  const handleDeleteJob = (jobId: string) => {
    if (confirm('Are you sure you want to delete this scheduled job?')) {
      scheduledJobsService.deleteScheduledJob(jobId);
      loadData();
    }
  };

  const handleToggleJob = (jobId: string) => {
    scheduledJobsService.toggleScheduledJob(jobId);
    loadData();
  };

  const handleExecuteNow = async (jobId: string) => {
    try {
      await scheduledJobsService.executeJobNow(jobId);
      loadData();
      alert('Job executed successfully!');
    } catch (error) {
      alert(`Failed to execute job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSegmentChange = (segmentId: string) => {
    const id = parseInt(segmentId);
    const segment = segments.find(s => s.id === id);
    setFormData({
      ...formData,
      segmentId: id,
      segmentName: segment?.name || ''
    });
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const tags = value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    setFormData({ ...formData, tags });
  };

  const formatSchedule = (job: ScheduledJob) => {
    const schedule = job.schedule;
    switch (schedule.type) {
      case 'interval':
        return `Every ${schedule.intervalMinutes} minutes`;
      case 'daily':
        return `Daily at ${schedule.dailyTime}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${days[schedule.weeklyDay || 0]} at ${schedule.weeklyTime}`;
      case 'monthly':
        return `Monthly on day ${schedule.monthlyDay} at ${schedule.monthlyTime}`;
      default:
        return 'Unknown schedule';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getJobStatusIcon = (job: ScheduledJob) => {
    if (!job.isActive) {
      return <Pause className="h-4 w-4 text-gray-400" />;
    }
    
    if (job.lastResult) {
      if (job.lastResult.success) {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      } else {
        return <XCircle className="h-4 w-4 text-red-500" />;
      }
    }
    
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Scheduled Bulk Operations</h1>
          <p className="text-gray-600 mt-1">
            Automatically execute bulk tagging operations on a schedule
          </p>
        </div>
        <Button onClick={handleCreateJob} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Scheduled Job
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
            <Timer className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {schedulerStatus.totalJobs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Jobs</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {schedulerStatus.activeJobs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Next Run</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-gray-900">
              {schedulerStatus.nextRun 
                ? new Date(schedulerStatus.nextRun).toLocaleString()
                : 'No active jobs'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Recent Executions</CardTitle>
            <Calendar className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {schedulerStatus.recentExecutions}
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium text-gray-900">Scheduled Jobs</CardTitle>
          <Button
            onClick={() => {
              scheduledJobsService.clearJobResults();
              loadData();
            }}
            variant="outline"
            size="sm"
          >
            Clear Results
          </Button>
        </CardHeader>
        <CardContent>
          {scheduledJobs.length === 0 ? (
            <div className="text-center py-12">
              <Timer className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No scheduled jobs</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Create your first scheduled job to automatically execute bulk tagging operations on a regular schedule.
              </p>
              <Button onClick={handleCreateJob} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Scheduled Job
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        {getJobStatusIcon(job)}
                        <span>{job.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{job.segmentName}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={job.operation === 'add' ? 'default' : 'secondary'}>
                          {job.operation === 'add' ? 'Add' : 'Remove'} Tags
                        </Badge>
                        <div className="text-xs text-gray-500">
                          {job.tags.join(', ')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatSchedule(job)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={job.isActive}
                          onCheckedChange={() => handleToggleJob(job.id)}
                        />
                        <Badge variant={job.isActive ? 'default' : 'secondary'}>
                          {job.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.lastRun ? formatDate(job.lastRun) : 'Never'}
                      {job.lastResult && (
                        <div className="text-xs text-gray-500 mt-1">
                          {job.lastResult.success 
                            ? `✓ ${job.lastResult.processedCount} processed`
                            : `✗ Failed`
                          }
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.nextRun && job.isActive 
                        ? new Date(job.nextRun).toLocaleString()
                        : 'Not scheduled'
                      }
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditJob(job)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExecuteNow(job.id)}>
                            <Play className="mr-2 h-4 w-4" />
                            Execute Now
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Job Form Dialog */}
      <Dialog open={showJobForm} onOpenChange={setShowJobForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingJob ? 'Edit Scheduled Job' : 'Create Scheduled Job'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label htmlFor="jobName">Job Name</Label>
              <Input
                id="jobName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter job name"
              />
            </div>

            <div>
              <Label>Target Segment</Label>
              <Select 
                value={formData.segmentId.toString()} 
                onValueChange={handleSegmentChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id.toString()}>
                      {segment.name} ({segment.customer_count || 0} customers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Operation</Label>
              <Select 
                value={formData.operation} 
                onValueChange={(value: 'add' | 'remove') => setFormData({ ...formData, operation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Tags</SelectItem>
                  <SelectItem value="remove">Remove Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="Enter tags separated by commas (e.g., vip, newsletter, sale)"
              />
              {formData.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Schedule Type</Label>
              <Select 
                value={formData.scheduleType} 
                onValueChange={(value: any) => setFormData({ ...formData, scheduleType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interval">Interval (Minutes)</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule-specific fields */}
            {formData.scheduleType === 'interval' && (
              <div>
                <Label htmlFor="intervalMinutes">Interval (Minutes)</Label>
                <Input
                  id="intervalMinutes"
                  type="number"
                  min="1"
                  value={formData.intervalMinutes}
                  onChange={(e) => setFormData({ ...formData, intervalMinutes: parseInt(e.target.value) || 60 })}
                />
              </div>
            )}

            {formData.scheduleType === 'daily' && (
              <div>
                <Label htmlFor="dailyTime">Time</Label>
                <Input
                  id="dailyTime"
                  type="time"
                  value={formData.dailyTime}
                  onChange={(e) => setFormData({ ...formData, dailyTime: e.target.value })}
                />
              </div>
            )}

            {formData.scheduleType === 'weekly' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Day of Week</Label>
                  <Select 
                    value={formData.weeklyDay.toString()} 
                    onValueChange={(value) => setFormData({ ...formData, weeklyDay: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="weeklyTime">Time</Label>
                  <Input
                    id="weeklyTime"
                    type="time"
                    value={formData.weeklyTime}
                    onChange={(e) => setFormData({ ...formData, weeklyTime: e.target.value })}
                  />
                </div>
              </div>
            )}

            {formData.scheduleType === 'monthly' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monthlyDay">Day of Month</Label>
                  <Input
                    id="monthlyDay"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.monthlyDay}
                    onChange={(e) => setFormData({ ...formData, monthlyDay: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label htmlFor="monthlyTime">Time</Label>
                  <Input
                    id="monthlyTime"
                    type="time"
                    value={formData.monthlyTime}
                    onChange={(e) => setFormData({ ...formData, monthlyTime: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowJobForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveJob} className="bg-blue-600 hover:bg-blue-700">
                {editingJob ? 'Update Job' : 'Create Job'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 