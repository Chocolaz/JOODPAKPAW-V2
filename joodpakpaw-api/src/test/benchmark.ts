import 'dotenv/config';
import { createApp } from '../app';
import http from 'http';
import { AddressInfo } from 'net';

async function runBenchmark() {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  console.log(`🚀 Server listening on ${baseUrl} for performance benchmark...`);

  async function query(urlPath: string) {
    const start = performance.now();
    const res = await fetch(`${baseUrl}${urlPath}`);
    const elapsed = performance.now() - start;
    const json = (await res.json()) as any;
    return { status: res.status, elapsed, dataLength: json?.data?.length, pagination: json?.pagination };
  }

  // 0. Pre-warm DB connection pool (excluding TLS/TCP connection overhead to Singapore)
  await query('/health');

  // 1. Cold search with filters, sorting, and pagination
  console.log('\n--- 1. Cold Search Benchmark (Warm Pool, Uncached Endpoint) ---');
  const coldUrl = '/api/v1/properties?minRating=4&sortBy=price&page=1&limit=12';
  const coldResult = await query(coldUrl);
  console.log(`Cold Query [${coldUrl}]:`);
  console.log(`  Status: ${coldResult.status}`);
  console.log(`  Latency: ${coldResult.elapsed.toFixed(2)} ms`);
  console.log(`  Data Rows: ${coldResult.dataLength}`);
  console.log(`  Pagination: ${JSON.stringify(coldResult.pagination)}`);

  // 2. Second search (Cache Hit)
  console.log('\n--- 2. Warm / Cached Search Benchmark ---');
  const warmResult = await query(coldUrl);
  console.log(`Warm Query [${coldUrl}]:`);
  console.log(`  Status: ${warmResult.status}`);
  console.log(`  Latency: ${warmResult.elapsed.toFixed(2)} ms`);

  // 3. Complex Search (Pet Type + Max Price + Sorting by popular)
  console.log('\n--- 3. Complex Filter Search (Dog + MaxPrice 1000 + Sort: popular) ---');
  const complexUrl = '/api/v1/properties?petTypes=Dog&maxPrice=1000&sortBy=popular&page=1&limit=12';
  const complexResult = await query(complexUrl);
  console.log(`Complex Query [${complexUrl}]:`);
  console.log(`  Status: ${complexResult.status}`);
  console.log(`  Latency: ${complexResult.elapsed.toFixed(2)} ms`);
  console.log(`  Data Rows: ${complexResult.dataLength}`);
  console.log(`  Pagination: ${JSON.stringify(complexResult.pagination)}`);

  server.close();
  console.log('\n🏁 Benchmark completed successfully.');
}

runBenchmark().catch((err) => {
  console.error('❌ Benchmark error:', err);
  process.exit(1);
});
