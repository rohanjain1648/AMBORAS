import useSWR from 'swr';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('amboras_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const error: any = new Error('An error occurred while fetching the data.');
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export function useOverview(period: string = 'month') {
  const { data, error, isLoading } = useSWR(
    `/api/v1/analytics/overview?period=${period}`, 
    fetcher,
    { refreshInterval: 60000 } // Refresh every 60s
  );

  return {
    data,
    isLoading,
    isError: error
  };
}

export function useTopProducts() {
  const { data, error, isLoading } = useSWR(
    `/api/v1/analytics/top-products`, 
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    data,
    isLoading,
    isError: error
  };
}
