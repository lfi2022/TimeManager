import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');const envFile=resolve(root,'.env');
if(existsSync(envFile))for(const line of readFileSync(envFile,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'');}
const command=process.platform==='win32'?'pnpm.cmd':'pnpm';const result=spawnSync(command,['--filter','@lfinfo/backend','exec','prisma',...process.argv.slice(2),'--schema','prisma/schema.prisma'],{cwd:root,stdio:'inherit',env:process.env,shell:process.platform==='win32'});if(result.error) console.error(result.error.message); process.exit(result.status??1);