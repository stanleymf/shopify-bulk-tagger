import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Play, 
  Pause, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Activity,
  Clock,
  Users,
  Zap,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { segmentMonitor, MonitoringRule, SegmentChange } from "@/lib/segment-monitor";
import { shopifyAPI } from "@/lib/shopify-api";

interface MonitoringRuleFormData {
  name: string;
  triggerType: 'segment_enter' | 'segment_exit' | 'segment_move';
  sourceSegment?: string;
  targetSegment: string;
  actions: Array<{ type: 'add' | 'remove'; tag: string; id: string }>;
}

export function SegmentMonitoring() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringRules, setMonitoringRules] = useState<MonitoringRule[]>([]);
  const [changeHistory, setChangeHistory] = useState<SegmentChange[]>([]);
  const [segments, setSegments] = useState<Array<{ id: number; name: string }>>([]);
  const [monitoringStatus, setMonitoringStatus] = useState({
    isMonitoring: false,
    activeRules: 0,
    totalRules: 0,
    segmentCount: 0,
  });

  // Form state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<MonitoringRule | null>(null);
  const [formData, setFormData] = useState<MonitoringRuleFormData>({
    name: '',
    triggerType: 'segment_enter',
    targetSegment: '',
    actions: [{ id: 'action-0', type: 'add', tag: '' }],
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load segments
      if (shopifyAPI.isInitialized()) {
        const segmentData = await shopifyAPI.getCustomerSegments();
        setSegments(segmentData);
      }

      // Load monitoring data
      const rules = segmentMonitor.getMonitoringRules();
      const history = segmentMonitor.getChangeHistory(20);
      const status = segmentMonitor.getMonitoringStatus();

      setMonitoringRules(rules);
      setChangeHistory(history);
      setMonitoringStatus(status);
      setIsMonitoring(status.isMonitoring);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    }
  };



  const handleForceCheck = async () => {
    try {
      const changes = await segmentMonitor.forceCheck();
      setChangeHistory(changes);
      loadData();
    } catch (error) {
      console.error('Failed to force check:', error);
      alert('Failed to check for changes. Please check your Shopify connection.');
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      triggerType: 'segment_enter',
      targetSegment: '',
      actions: [{ id: 'action-0', type: 'add', tag: '' }],
    });
    setShowRuleForm(true);
  };

  const handleEditRule = (rule: MonitoringRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      triggerType: rule.triggerType,
      sourceSegment: rule.sourceSegment || '',
      targetSegment: rule.targetSegment,
      actions: rule.actions.map((action, index) => ({
        ...action,
        id: `action-${index}`,
      })),
    });
    setShowRuleForm(true);
  };

  const handleSaveRule = () => {
    if (!formData.name.trim() || !formData.targetSegment || 
        formData.actions.some(action => !action.tag.trim())) {
      alert('Please fill in all required fields');
      return;
    }

    const ruleData = {
      name: formData.name.trim(),
      triggerType: formData.triggerType,
      sourceSegment: formData.sourceSegment || undefined,
      targetSegment: formData.targetSegment,
      actions: formData.actions
        .filter(action => action.tag.trim())
        .map(({ id, ...action }) => action),
      isActive: true,
    };

    if (editingRule) {
      segmentMonitor.updateMonitoringRule(editingRule.id, ruleData);
    } else {
      segmentMonitor.addMonitoringRule(ruleData);
    }

    setShowRuleForm(false);
    loadData();
  };

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      segmentMonitor.deleteMonitoringRule(ruleId);
      loadData();
    }
  };

  const handleToggleRule = (ruleId: string) => {
    const rule = monitoringRules.find(r => r.id === ruleId);
    if (rule) {
      segmentMonitor.updateMonitoringRule(ruleId, { isActive: !rule.isActive });
      loadData();
    }
  };

  const addAction = () => {
    const newId = `action-${Date.now()}`;
    setFormData({
      ...formData,
      actions: [...formData.actions, { id: newId, type: 'add', tag: '' }],
    });
  };

  const removeAction = (id: string) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter(action => action.id !== id),
    });
  };

  const updateAction = (id: string, field: 'type' | 'tag', value: string) => {
    setFormData({
      ...formData,
      actions: formData.actions.map(action =>
        action.id === id ? { ...action, [field]: value } : action
      ),
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTriggerDescription = (rule: MonitoringRule) => {
    switch (rule.triggerType) {
      case 'segment_enter':
        return `When customer enters "${rule.targetSegment}"`;
      case 'segment_exit':
        return `When customer exits "${rule.sourceSegment}"`;
      case 'segment_move':
        return `When customer moves from "${rule.sourceSegment}" to "${rule.targetSegment}"`;
      default:
        return 'Unknown trigger';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Real-time Segment Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Automatically monitors customer segment changes and applies tags based on rules
          </p>
          <div className="flex items-center mt-2 space-x-2">
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm text-gray-600">
              {isMonitoring ? 'Background monitoring active' : 'Waiting for Shopify connection...'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleForceCheck}
            variant="outline"
            disabled={!shopifyAPI.isInitialized()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Force Check
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      {!isMonitoring && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900">Automatic Background Monitoring</h3>
              <p className="text-sm text-blue-700 mt-1">
                Monitoring will automatically start once your Shopify store is connected. 
                No manual start/stop required - it runs continuously in the background.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Background Monitoring</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium">
                {isMonitoring ? 'Active' : 'Waiting'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isMonitoring ? 'Checking every 30 seconds' : 'Will start when connected'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Rules</CardTitle>
            <Zap className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {monitoringStatus.activeRules}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Monitored Segments</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {monitoringStatus.segmentCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Recent Changes</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {changeHistory.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium text-gray-900">Monitoring Rules</CardTitle>
          <Button onClick={handleCreateRule} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </CardHeader>
        <CardContent>
          {monitoringRules.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No monitoring rules created</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Create your first monitoring rule to automatically manage customer tags when they move between segments.
              </p>
              <Button onClick={handleCreateRule} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitoringRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell className="text-sm">{getTriggerDescription(rule)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {rule.actions.map((action, index) => (
                          <Badge 
                            key={index}
                            variant={action.type === 'add' ? 'default' : 'secondary'}
                            className={action.type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {action.type === 'add' ? '+' : '-'} {action.tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                        />
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{rule.executionCount}</TableCell>
                    <TableCell className="text-sm">
                      {rule.lastTriggered ? formatDate(rule.lastTriggered) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteRule(rule.id)}
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

      {/* Recent Changes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium text-gray-900">Recent Segment Changes</CardTitle>
          <Badge variant="outline" className="text-xs">
            {changeHistory.length} total changes
          </Badge>
        </CardHeader>
        <CardContent>
          {changeHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-600">No recent segment changes detected</p>
              <p className="text-sm text-gray-500 mt-1">Changes will appear here when customers move between segments</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {changeHistory.slice(0, 50).map((change, index) => {
                const customerId = change.customerId.split('/').pop() || change.customerId;
                const segmentName = change.toSegments[0] || change.fromSegments[0];
                const actionText = change.changeType === 'added' ? 'joined' : 'left';
                const actionIcon = change.changeType === 'added' ? '→' : '←';
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3 flex-1">
                      <Badge 
                        variant={change.changeType === 'added' ? 'default' : 'secondary'}
                        className={change.changeType === 'added' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {change.changeType === 'added' ? 'Added' : 'Removed'}
                      </Badge>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            Customer {customerId}
                          </span>
                          {change.customerEmail && change.customerEmail !== 'Unknown' && change.customerEmail !== '' && (
                            <span className="text-sm text-gray-600">
                              ({change.customerEmail})
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">{actionText}</span>
                          <span className="text-xs font-mono text-gray-400">{actionIcon}</span>
                          <span className="text-xs font-medium text-blue-600">{segmentName}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-xs text-gray-500">
                        {formatDate(change.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {changeHistory.length > 50 && (
                <div className="text-center py-2">
                  <span className="text-xs text-gray-500">
                    Showing latest 50 of {changeHistory.length} changes
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Form Dialog */}
      <Dialog open={showRuleForm} onOpenChange={setShowRuleForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Monitoring Rule' : 'Create Monitoring Rule'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label htmlFor="ruleName">Rule Name</Label>
              <Input
                id="ruleName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter rule name"
              />
            </div>

            <div>
              <Label>Trigger Type</Label>
              <Select 
                value={formData.triggerType} 
                onValueChange={(value: any) => setFormData({ ...formData, triggerType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="segment_enter">Customer enters segment</SelectItem>
                  <SelectItem value="segment_exit">Customer exits segment</SelectItem>
                  <SelectItem value="segment_move">Customer moves between segments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.triggerType === 'segment_exit' || formData.triggerType === 'segment_move') && (
              <div>
                <Label>Source Segment</Label>
                <Select 
                  value={formData.sourceSegment || ''} 
                  onValueChange={(value) => setFormData({ ...formData, sourceSegment: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.name}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Target Segment</Label>
              <Select 
                value={formData.targetSegment} 
                onValueChange={(value) => setFormData({ ...formData, targetSegment: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target segment" />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.name}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Actions</Label>
                <Button type="button" onClick={addAction} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Action
                </Button>
              </div>
              
              <div className="space-y-3">
                {formData.actions.map((action) => (
                  <div key={action.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Select 
                      value={action.type} 
                      onValueChange={(value: 'add' | 'remove') => updateAction(action.id, 'type', value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">Add</SelectItem>
                        <SelectItem value="remove">Remove</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      value={action.tag}
                      onChange={(e) => updateAction(action.id, 'tag', e.target.value)}
                      placeholder="Tag name"
                      className="flex-1"
                    />
                    
                    {formData.actions.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeAction(action.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowRuleForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRule} className="bg-blue-600 hover:bg-blue-700">
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 