// ─── Vec2 Math Utilities ────────────────────────────────────────
// Functional style — all operations return new objects, no mutation.

import type { Vec2 } from '../core/types';

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });

export const mag = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);

export const magSq = (v: Vec2): number => v.x * v.x + v.y * v.y;

export const normalize = (v: Vec2): Vec2 => {
    const m = mag(v);
    return m > 0 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
};

export const limit = (v: Vec2, max: number): Vec2 => {
    const msq = magSq(v);
    if (msq > max * max) {
        const m = Math.sqrt(msq);
        return { x: (v.x / m) * max, y: (v.y / m) * max };
    }
    return v;
};

export const dist = (a: Vec2, b: Vec2): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
};

export const distSq = (a: Vec2, b: Vec2): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

export const heading = (v: Vec2): number => Math.atan2(v.y, v.x);

export const setMag = (v: Vec2, m: number): Vec2 => {
    const n = normalize(v);
    return { x: n.x * m, y: n.y * m };
};

export const zero = (): Vec2 => ({ x: 0, y: 0 });

export const random = (maxMag: number = 1): Vec2 => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * maxMag;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
};
