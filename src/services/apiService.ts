/// <reference types="vite/client" />
export interface PublicDataResponse {
  currentCount: number;
  data: any[];
  matchCount: number;
  page: number;
  perPage: number;
  totalCount: number;
}

const BASE_URL = 'https://api.odcloud.kr/api';
const ENDPOINT = '/15062804/v1/uddi:174573b5-4dfd-4c5d-b5e6-8c51f5f7dcb4';
// Get the key from environment variables
const API_KEY = import.meta.env.VITE_ODCLOUD_API_KEY;

export async function fetchPublicData(page = 1, perPage = 10): Promise<PublicDataResponse> {
  if (!API_KEY) {
    throw new Error('Public Data API Key is missing. Please check your .env file and ensure VITE_ODCLOUD_API_KEY is set.');
  }

  const url = `${BASE_URL}${ENDPOINT}?serviceKey=${encodeURIComponent(API_KEY)}&page=${page}&perPage=${perPage}&returnType=JSON`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Fetch operation failed:', error);
    throw error;
  }
}

export async function fetchBulkPublicData(perPage = 1000): Promise<PublicDataResponse> {
  if (!API_KEY) {
    throw new Error('Public Data API Key is missing. Please check your .env file and ensure VITE_ODCLOUD_API_KEY is set.');
  }

  // Fetching a larger chunk for Excel export
  const url = `${BASE_URL}${ENDPOINT}?serviceKey=${encodeURIComponent(API_KEY)}&page=1&perPage=${perPage}&returnType=JSON`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Bulk fetch operation failed:', error);
    throw error;
  }
}
