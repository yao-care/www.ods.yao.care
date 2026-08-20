// llms-full.txt 由 src/data/llms.js 於 build 時產生，與 llms.txt 同源。
import { llmsFull } from '../data/llms.js';

export const GET = () =>
  new Response(llmsFull(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
