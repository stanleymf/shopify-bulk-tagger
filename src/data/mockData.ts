export interface CustomerSegment {
  id: string;
  name: string;
  customerCount: number;
  lastSync: string;
}

// Empty arrays - no mock data
export const mockSegments: CustomerSegment[] = [];