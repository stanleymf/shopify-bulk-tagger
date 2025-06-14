import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, Plus, AlertCircle } from "lucide-react";
import { mockSegments, type CustomerSegment } from "@/data/mockData";

export function Dashboard() {
  const [segments, setSegments] = useState<CustomerSegment[]>(mockSegments);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const totalCustomers = segments.reduce((sum, segment) => sum + segment.customerCount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customer Segments</h1>
          <p className="text-gray-600 mt-1">Manage your Shopify customer segments and their tags</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Sync Segments
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Segments</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{segments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalCustomers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Last Sync</CardTitle>
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {segments.length > 0 ? "Just now" : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900">Segments Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {segments.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No segments found</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Connect your Shopify store to sync customer segments and start managing your customer tags.
              </p>
              <div className="space-x-4">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Shopify Store
                </Button>
                <Button variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Segments
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-gray-700">Segment Name</TableHead>
                  <TableHead className="font-medium text-gray-700">Customer Count</TableHead>
                  <TableHead className="font-medium text-gray-700">Last Sync</TableHead>
                  <TableHead className="font-medium text-gray-700">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => (
                  <TableRow key={segment.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">{segment.name}</TableCell>
                    <TableCell className="text-gray-700">{segment.customerCount.toLocaleString()}</TableCell>
                    <TableCell className="text-gray-600">{formatDate(segment.lastSync)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                        Synced
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}