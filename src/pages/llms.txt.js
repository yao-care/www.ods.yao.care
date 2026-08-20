// llms.txt 由 src/data/llms.js 於 build 時產生（原本是 public/ 下的手寫檔，會漂）。
import { llmsIndex } from '../data/llms.js';

export const GET = () =>
  new Response(llmsIndex(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
