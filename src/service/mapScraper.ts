import axios from 'axios';
import * as cheerio from 'cheerio';
import { MapLocation } from '../types/map';

export class MapScraperService {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private readonly googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  async scrapeLocations(query: string, location?: string, limit: number = 10): Promise<MapLocation[]> {
    try {
      const searchQuery = location ? `${query} ${location}` : query;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const locations: MapLocation[] = [];

      $('.section-result').slice(0, limit).each((_, element) => {
        const $el = $(element);
        
        locations.push({
          name: $el.find('.section-result-title').text().trim(),
          address: $el.find('.section-result-location').text().trim(),
          rating: parseFloat($el.find('.section-result-rating').text()) || undefined,
          totalReviews: parseInt($el.find('.section-result-num-ratings').text()) || undefined,
          category: $el.find('.section-result-details').text().trim() || undefined
        });
      });

      return locations;
    } catch (error) {
      throw new Error(`Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
 async scrapeOpenStreetMap(query: string, location?: string, limit: number = 10): Promise<MapLocation[]> {
    try {
      const formattedLocation = this.formatLocation(location);
      const searchQuery = formattedLocation ? `${query} in ${formattedLocation}` : query;
      
      const url = `https://nominatim.openstreetmap.org/search`;
      
      const response = await axios.get(url, {
        params: {
          q: searchQuery,
          format: 'json',
          limit: limit * 2, 
          addressdetails: 1,
          extratags: 1,
          namedetails: 1
        },
        headers: { 'User-Agent': 'MapScraperAPI/1.0' }
      });

      let filtered = response.data;
      if (formattedLocation) {
        const countryCode = this.getCountryCode(formattedLocation);
        if (countryCode) {
          filtered = filtered.filter((item: any) => 
            item.address?.country_code === countryCode.toLowerCase()
          );
        }
      }

      return filtered.slice(0, limit).map((item: any) => ({
        name: item.name || item.display_name.split(',')[0],
        address: item.display_name,
        category: item.type,
        phone: item.extratags?.phone || item.extratags?.['contact:phone'] || undefined,
        website: item.extratags?.website || item.extratags?.['contact:website'] || undefined,
        coordinates: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }
      }));
    } catch (error) {
      throw new Error(`OpenStreetMap scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatLocation(location?: string): string {
    if (!location) return '';
    
    // Handle common variations
    const locationMap: Record<string, string> = {
      'newyork': 'New York, USA',
      'new york': 'New York, USA',
      'nyc': 'New York City, USA',
      'la': 'Los Angeles, USA',
      'sf': 'San Francisco, USA',
      'london': 'London, UK',
      'paris': 'Paris, France',
      'tokyo': 'Tokyo, Japan',
      'karachi': 'Karachi, Pakistan',
    };

    const normalized = location.toLowerCase().trim();
    return locationMap[normalized] || location;
  }

  private getCountryCode(location: string): string | null {
    const countryMap: Record<string, string> = {
      'usa': 'us',
      'united states': 'us',
      'uk': 'gb',
      'united kingdom': 'gb',
      'france': 'fr',
      'japan': 'jp',
      'pakistan': 'pk',
      'india': 'in',
      'china': 'cn',
      'germany': 'de',
      'canada': 'ca',
      'australia': 'au',
    };

    for (const [key, code] of Object.entries(countryMap)) {
      if (location.toLowerCase().includes(key)) {
        return code;
      }
    }
    return null;
  }
  async scrapeGooglePlaces(query: string, location?: string, limit: number = 10): Promise<MapLocation[]> {
    if (!this.googleApiKey) {
      throw new Error('Google Places API key not configured');
    }

    try {
      // Text Search
      const searchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
      const searchQuery = location ? `${query} in ${location}` : query;

      const response = await axios.get(searchUrl, {
        params: {
          query: searchQuery,
          key: this.googleApiKey,
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const places = response.data.results.slice(0, limit);
      
      // Get detailed info for each place
      const detailedPlaces = await Promise.all(
        places.map(async (place: any) => {
          const detailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
          const detailsResponse = await axios.get(detailsUrl, {
            params: {
              place_id: place.place_id,
              fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,geometry,types',
              key: this.googleApiKey
            }
          });

          const details = detailsResponse.data.result;
          
          return {
            name: details.name,
            address: details.formatted_address,
            rating: details.rating,
            totalReviews: details.user_ratings_total,
            category: details.types?.[0],
            phone: details.formatted_phone_number,
            website: details.website,
            coordinates: {
              lat: details.geometry?.location.lat,
              lng: details.geometry?.location.lng
            },
            openingHours: details.opening_hours?.weekday_text
          };
        })
      );

      return detailedPlaces;
    } catch (error) {
      throw new Error(`Google Places scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}