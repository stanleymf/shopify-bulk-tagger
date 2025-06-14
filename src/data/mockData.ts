export interface CustomerSegment {
  id: string;
  name: string;
  customerCount: number;
  lastSync: string;
}

export interface TaggingRule {
  id: string;
  name: string;
  isActive: boolean;
  triggerSegment: string;
  actions: {
    type: 'add' | 'remove';
    tag: string;
  }[];
  createdAt: string;
}

// Empty arrays - no mock data
export const mockSegments: CustomerSegment[] = [];
export const mockRules: TaggingRule[] = [];