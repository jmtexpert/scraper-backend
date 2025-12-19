export interface MapLocation {
  name: string;
  address: string;
  rating?: number;
  totalReviews?: number;
  category?: string;
  phone?: string;
  website?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  openingHours?: string[];
}

export interface ScrapeRequest {
  query: string;
  location?: string;
  limit?: number;
}