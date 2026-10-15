#!/usr/bin/env node
/**
 * canon-outline — นับ h1/h2/h3 + บรรทัด + ตัวอักษรของคัมภีร์ แล้วพิมพ์เป็น TOC
 *
 * ใช้: node scripts/canon-outline.mjs [ไฟล์...]
 *      (ไม่ระบุไฟล์ = AGENTS.md + docs/*.md)
 * รหัสออก: 1 ถ้า AGENTS.md เกินงบตัวอักษร — ใช้เป็น gate ได้
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CORE = 'AGENTS.md';
const DOCS_DIR = 'docs';
/** งบของชั้น core (AGENTS.md) วัดเป็น "ตัวอักษร" — ไม่มีมาตรฐานกลาง เป็นวินัยของโปรเจกต์ */
const CORE_CHAR_BUDGET = 6000;

function defaultFiles() {
	const files = [CORE];
	for (const name of readdirSync(DOCS_DIR).sort()) {
		const path = join(DOCS_DIR, name);
		if (name.endsWith('.md') && statSync(path).isFile()) files.push(path);
	}
	return files;
}

/** @param {string} file */
function outline(file) {
	const raw = readFileSync(file, 'utf8');
	const lines = raw.split(/\r?\n/);
	// ไฟล์ที่ลงท้ายด้วย newline จะได้ element ว่างท้าย array — ไม่นับเป็นบรรทัดจริง (ให้ตรงกับ wc -l)
	if (lines.at(-1) === '') lines.pop();
	const heads = [];
	let fence = null;
	for (let i = 0; i < lines.length; i++) {
		const fenceMark = /^\s*(```+|~~~+)/.exec(lines[i]);
		if (fenceMark) {
			const mark = fenceMark[1][0];
			if (fence === mark) fence = null;
			else if (!fence) fence = mark;
			continue;
		}
		if (fence) continue; // ไม่นับหัวข้อที่อยู่ใน code block
		const m = /^(#{1,3})\s+(.*)$/.exec(lines[i]);
		if (m) heads.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
	}
	const count = (level) => heads.filter((h) => h.level === level).length;
	return {
		file,
		total: lines.length,
		words: raw.trim().split(/\s+/).filter(Boolean).length,
		chars: raw.length,
		noSpace: raw.replace(/\s/g, '').length,
		h1: count(1),
		h2: count(2),
		h3: count(3),
		heads
	};
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles();
let exceeded = false;

for (const file of files) {
	const o = outline(file);
	const isCore = file === CORE;
	const over = isCore && o.chars > CORE_CHAR_BUDGET;
	// เจตนาคือ gate ของชั้น core (AGENTS.md) เท่านั้น
	if (over) exceeded = true;

	console.log(
		`${file}  lines=${o.total}  words=${o.words}  chars=${o.chars}  chars-x-space=${o.noSpace}${isCore ? `  งบ ${CORE_CHAR_BUDGET}` + (over ? ' OVER' : ' OK') : ''}  h1=${o.h1} h2=${o.h2} h3=${o.h3}`
	);
	for (const h of o.heads) {
		console.log(`${'  '.repeat(h.level)}${'#'.repeat(h.level)} ${h.text}  (L${h.line})`);
	}
	console.log('');
}

process.exit(exceeded ? 1 : 0);
