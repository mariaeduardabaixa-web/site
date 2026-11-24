/**
 * Generates crisp, transparent-background SVG artwork data URLs
 * for the 9 print categories and physical botton templates.
 */

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export const ARTWORK_SVGS = {
  // Minimalistas
  min_line_face: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g fill="none" stroke="#181A1F" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M96 80 C150 48, 224 72, 222 146 C220 210, 174 252, 134 250 C96 248, 86 212, 102 184"/>
        <path d="M150 74 C146 116, 146 146, 166 168 C176 178, 152 190, 138 184"/>
        <path d="M114 128 Q132 118 148 128"/>
        <path d="M174 126 Q190 116 204 128"/>
        <path d="M128 208 Q154 222 180 206"/>
      </g>
    </svg>
  `),
  min_arch_horizon: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g fill="none" stroke="#536895" stroke-width="4.5" stroke-linecap="round">
        <path d="M56 244 L56 140 A104 104 0 0 1 264 140 L264 244"/>
        <line x1="40" y1="244" x2="280" y2="244"/>
        <circle cx="160" cy="120" r="34" fill="#DBD6BE" stroke="#536895"/>
        <path d="M88 210 Q160 176 232 210" stroke="#181A1F"/>
      </g>
    </svg>
  `),

  // Florais
  floral_botanical_stem: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g fill="none" stroke="#2D3B32" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M160 280 C158 210, 166 140, 156 56"/>
        <path d="M160 218 C118 205, 92 178, 96 154 C124 156, 148 182, 160 218 Z" fill="#6F8A72" fill-opacity="0.32"/>
        <path d="M161 186 C206 172, 232 146, 224 122 C196 124, 174 150, 161 186 Z" fill="#6F8A72" fill-opacity="0.32"/>
        <path d="M159 138 C122 126, 102 100, 110 80 C134 84, 150 106, 159 138 Z" fill="#6F8A72" fill-opacity="0.32"/>
        <circle cx="156" cy="54" r="14" fill="#DBD6BE" stroke="#536895"/>
        <circle cx="138" cy="46" r="11" fill="#536895" fill-opacity="0.25" stroke="#536895"/>
        <circle cx="174" cy="46" r="11" fill="#536895" fill-opacity="0.25" stroke="#536895"/>
      </g>
    </svg>
  `),
  floral_wildflowers: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g stroke-linecap="round" stroke-linejoin="round">
        <path d="M110 264 Q124 185 110 118" fill="none" stroke="#3F5A45" stroke-width="4"/>
        <path d="M172 264 Q168 175 186 96" fill="none" stroke="#3F5A45" stroke-width="4"/>
        <path d="M214 264 Q202 200 220 148" fill="none" stroke="#3F5A45" stroke-width="4"/>
        <g transform="translate(110 108)" fill="#C97B63" stroke="#181A1F" stroke-width="2.5">
          <ellipse cx="0" cy="-18" rx="9" ry="15"/>
          <ellipse cx="17" cy="-6" rx="15" ry="9"/>
          <ellipse cx="11" cy="14" rx="9" ry="15" transform="rotate(35 11 14)"/>
          <ellipse cx="-11" cy="14" rx="9" ry="15" transform="rotate(-35 -11 14)"/>
          <ellipse cx="-17" cy="-6" rx="15" ry="9"/>
          <circle cx="0" cy="0" r="7" fill="#DBD6BE"/>
        </g>
        <g transform="translate(188 86)" fill="#536895" stroke="#181A1F" stroke-width="2.5">
          <circle cx="0" cy="-16" r="11"/>
          <circle cx="16" cy="0" r="11"/>
          <circle cx="0" cy="16" r="11"/>
          <circle cx="-16" cy="0" r="11"/>
          <circle cx="0" cy="0" r="8" fill="#FAF9F5"/>
        </g>
        <circle cx="220" cy="140" r="14" fill="#DBD6BE" stroke="#181A1F" stroke-width="2.5"/>
      </g>
    </svg>
  `),

  // Abstratas
  abs_organic_shapes: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <path d="M62 128 C44 64, 134 32, 184 74 C234 116, 206 184, 144 198 C82 212, 74 176, 62 128 Z" fill="#536895" fill-opacity="0.86"/>
      <path d="M138 148 C186 112, 268 134, 266 208 C264 268, 178 286, 138 240 C106 202, 108 170, 138 148 Z" fill="#C97B63" fill-opacity="0.72"/>
      <circle cx="214" cy="96" r="32" fill="#DBD6BE"/>
      <path d="M56 226 Q132 198 202 252" fill="none" stroke="#181A1F" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `),
  abs_brush_strokes: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <path d="M46 98 Q152 62 272 104" fill="none" stroke="#536895" stroke-width="28" stroke-linecap="round"/>
      <path d="M66 164 Q162 196 254 152" fill="none" stroke="#181A1F" stroke-width="20" stroke-linecap="round"/>
      <path d="M84 226 Q170 212 246 238" fill="none" stroke="#B69F73" stroke-width="24" stroke-linecap="round"/>
    </svg>
  `),

  // Geométricas
  geo_bauhaus_grid: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect x="48" y="48" width="104" height="104" fill="#536895"/>
      <circle cx="220" cy="100" r="52" fill="#C97B63"/>
      <path d="M48 168 L152 168 L152 272 Z" fill="#181A1F"/>
      <rect x="168" y="168" width="104" height="104" rx="52" fill="#DBD6BE" stroke="#181A1F" stroke-width="4"/>
    </svg>
  `),
  geo_concentric: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g fill="none" stroke="#181A1F" stroke-width="4">
        <rect x="48" y="48" width="224" height="224" rx="16"/>
        <circle cx="160" cy="160" r="88" stroke="#536895" stroke-width="6"/>
        <circle cx="160" cy="160" r="56" stroke="#181A1F" stroke-width="4"/>
        <polygon points="160,118 198,186 122,186" fill="#536895" stroke="none"/>
      </g>
    </svg>
  `),

  // Natureza
  nat_mountain_sun: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <circle cx="212" cy="96" r="36" fill="#D59B52"/>
      <path d="M40 236 L118 118 L178 196 L220 144 L282 236 Z" fill="#536895" stroke="#181A1F" stroke-width="4" stroke-linejoin="round"/>
      <path d="M36 254 Q160 236 284 254" fill="none" stroke="#181A1F" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `),
  nat_monstera: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <path d="M160 272 L160 72" stroke="#2F4F3E" stroke-width="6" stroke-linecap="round"/>
      <path d="M160 64 C100 66, 62 118, 72 178 L118 164 L78 202 C92 238, 134 250, 160 234 C186 250, 228 238, 242 202 L202 164 L248 178 C258 118, 220 66, 160 64 Z" fill="#4E725C" stroke="#181A1F" stroke-width="4" stroke-linejoin="round"/>
    </svg>
  `),

  // Artísticas
  art_matisse_cutout: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <path d="M160 56 C132 76, 114 114, 128 148 C92 152, 68 186, 86 226 C116 244, 146 218, 160 256 C174 218, 204 244, 234 226 C252 186, 228 152, 192 148 C206 114, 188 76, 160 56 Z" fill="#2A4D8F"/>
      <circle cx="160" cy="154" r="22" fill="#FAF9F5"/>
    </svg>
  `),
  art_terracotta_vase: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <path d="M126 92 L194 92 L182 128 C218 156, 220 226, 188 262 L132 262 C100 226, 102 156, 138 128 Z" fill="#C46D53" stroke="#181A1F" stroke-width="4" stroke-linejoin="round"/>
      <path d="M158 92 Q132 54 114 48" fill="none" stroke="#3F5A45" stroke-width="4" stroke-linecap="round"/>
      <path d="M162 92 Q188 50 212 44" fill="none" stroke="#3F5A45" stroke-width="4" stroke-linecap="round"/>
      <circle cx="114" cy="48" r="9" fill="#536895"/>
      <circle cx="212" cy="44" r="9" fill="#DBD6BE" stroke="#181A1F" stroke-width="2.5"/>
    </svg>
  `),

  // Vintage
  vin_atelier_stamp: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <circle cx="160" cy="160" r="110" fill="none" stroke="#181A1F" stroke-width="5"/>
      <circle cx="160" cy="160" r="96" fill="none" stroke="#536895" stroke-width="2.5" stroke-dasharray="6 5"/>
      <text x="160" y="132" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="#181A1F" letter-spacing="4">ATELIER</text>
      <line x1="94" y1="152" x2="226" y2="152" stroke="#536895" stroke-width="3"/>
      <text x="160" y="182" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-style="italic" fill="#536895">Algodão Cru</text>
      <text x="160" y="216" text-anchor="middle" font-family="monospace" font-size="14" fill="#181A1F" letter-spacing="3">EST. 2026</text>
    </svg>
  `),
  vin_retro_waves: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <circle cx="160" cy="130" r="72" fill="#D59B52"/>
      <path d="M56 176 Q108 152 160 176 T264 176" fill="none" stroke="#536895" stroke-width="14" stroke-linecap="round"/>
      <path d="M56 208 Q108 184 160 208 T264 208" fill="none" stroke="#181A1F" stroke-width="12" stroke-linecap="round"/>
      <path d="M56 240 Q108 216 160 240 T264 240" fill="none" stroke="#536895" stroke-width="10" stroke-linecap="round"/>
    </svg>
  `),

  // Tipográficas
  typ_less_plastic: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect x="44" y="64" width="232" height="192" rx="14" fill="none" stroke="#181A1F" stroke-width="4"/>
      <text x="160" y="126" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#181A1F">MENOS PLÁSTICO</text>
      <text x="160" y="172" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#536895" letter-spacing="3">MAIS HISTÓRIA</text>
      <line x1="88" y1="196" x2="232" y2="196" stroke="#181A1F" stroke-width="3"/>
      <text x="160" y="228" text-anchor="middle" font-family="monospace" font-size="14" fill="#5A606B">100% ALGODÃO SUSTENTÁVEL</text>
    </svg>
  `),
  typ_slow_living: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <text x="160" y="138" text-anchor="middle" font-family="Georgia, serif" font-size="46" font-style="italic" fill="#536895">Slow</text>
      <text x="160" y="194" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="800" fill="#181A1F" letter-spacing="4">LIVING</text>
      <circle cx="160" cy="230" r="6" fill="#536895"/>
    </svg>
  `),

  // Modernas
  mod_kinetic_rings: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g fill="none" stroke="#181A1F" stroke-width="5">
        <ellipse cx="160" cy="160" rx="108" ry="44" transform="rotate(-25 160 160)" stroke="#536895"/>
        <ellipse cx="160" cy="160" rx="108" ry="44" transform="rotate(25 160 160)"/>
        <ellipse cx="160" cy="160" rx="108" ry="44" transform="rotate(90 160 160)" stroke="#536895"/>
        <circle cx="160" cy="160" r="14" fill="#181A1F"/>
      </g>
    </svg>
  `),
  mod_checker_wave: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <g fill="#536895">
        <rect x="64" y="64" width="48" height="48"/>
        <rect x="160" y="64" width="48" height="48"/>
        <rect x="112" y="112" width="48" height="48" fill="#181A1F"/>
        <rect x="208" y="112" width="48" height="48" fill="#181A1F"/>
        <rect x="64" y="160" width="48" height="48"/>
        <rect x="160" y="160" width="48" height="48"/>
        <rect x="112" y="208" width="48" height="48" fill="#181A1F"/>
        <rect x="208" y="208" width="48" height="48" fill="#181A1F"/>
      </g>
    </svg>
  `),

  // Bottons
  botton_ucla_club: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#536895"/>
      <circle cx="120" cy="120" r="96" fill="none" stroke="#DBD6BE" stroke-width="5"/>
      <text x="120" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#FAF9F5">INSIDE</text>
      <text x="120" y="146" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#DBD6BE" letter-spacing="4">ECO CLUB</text>
    </svg>
  `),
  botton_sun_smile: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#DBD6BE"/>
      <circle cx="120" cy="120" r="64" fill="#D59B52" stroke="#181A1F" stroke-width="6"/>
      <circle cx="100" cy="108" r="6" fill="#181A1F"/>
      <circle cx="140" cy="108" r="6" fill="#181A1F"/>
      <path d="M94 134 Q120 156 146 134" fill="none" stroke="#181A1F" stroke-width="6" stroke-linecap="round"/>
    </svg>
  `),
  botton_botanical_badge: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#3F5A45"/>
      <path d="M120 184 L120 56" stroke="#DBD6BE" stroke-width="6" stroke-linecap="round"/>
      <path d="M120 144 C80 130, 74 96, 92 84 C112 96, 118 122, 120 144 Z" fill="#DBD6BE"/>
      <path d="M120 118 C160 104, 166 70, 148 58 C128 70, 122 96, 120 118 Z" fill="#DBD6BE"/>
    </svg>
  `),
  botton_heart_craft: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#C97B63"/>
      <path d="M120 182 C70 144, 52 108, 72 80 C88 60, 112 68, 120 88 C128 68, 152 60, 168 80 C188 108, 170 144, 120 182 Z" fill="#FAF9F5"/>
    </svg>
  `),
  botton_monogram: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#181A1F"/>
      <circle cx="120" cy="120" r="88" fill="none" stroke="#536895" stroke-width="6"/>
      <text x="120" y="138" text-anchor="middle" font-family="Georgia, serif" font-size="72" font-style="italic" fill="#DBD6BE">IE</text>
    </svg>
  `),
  botton_eco_star: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#F2EFE4"/>
      <polygon points="120,42 142,94 198,98 154,134 168,188 120,158 72,188 86,134 42,98 98,94" fill="#536895" stroke="#181A1F" stroke-width="5" stroke-linejoin="round"/>
    </svg>
  `),
};
