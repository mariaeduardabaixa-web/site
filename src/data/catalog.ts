import {
  BagSizeId,
  BagSizeSpec,
  BottonTemplate,
  ComplaintReason,
  CottonColorOption,
  OrderTimelineStatus,
  PrintCategory,
  PrintTemplate,
} from '../types';
import { ARTWORK_SVGS } from '../utils/artworkGenerator';

export const BAG_SIZES: Record<BagSizeId, BagSizeSpec> = {
  P: {
    id: 'P',
    name: 'Pequena (P)',
    label: 'Pequena',
    price: 40.88,
    widthCm: 28,
    heightCm: 32,
    depthCm: 8,
    handleDropCm: 21,
    capacityDesc: 'Ideal para livros, caderno e itens essenciais do dia.',
    summary: '28 × 32 × 8 cm · Algodão cru 280g',
  },
  M: {
    id: 'M',
    name: 'Média (M)',
    label: 'Média',
    price: 50.0,
    widthCm: 35,
    heightCm: 40,
    depthCm: 10,
    handleDropCm: 25,
    capacityDesc: 'Proporção versátil para notebook de até 15", trabalho e compras.',
    summary: '35 × 40 × 10 cm · Algodão cru 280g',
  },
  G: {
    id: 'G',
    name: 'Grande (G)',
    label: 'Grande',
    price: 59.0,
    widthCm: 42,
    heightCm: 46,
    depthCm: 12,
    handleDropCm: 28,
    capacityDesc: 'Capacidade ampla com fole lateral reforçado para viagens e feira.',
    summary: '42 × 46 × 12 cm · Algodão cru 280g',
  },
};

export const COTTON_COLORS: CottonColorOption[] = [
  { id: 'pearl', name: 'Pérola Natural', hex: '#DBD6BE' },
  { id: 'raw-linen', name: 'Algodão Cru', hex: '#E8E3D2' },
  { id: 'warm-white', name: 'Branco Off-White', hex: '#F6F4EC' },
  { id: 'ucla-blue', name: 'Azul UCLA', hex: '#536895' },
  { id: 'navy-ink', name: 'Azul Marinho', hex: '#283652' },
  { id: 'sage-olive', name: 'Verde Sálvia', hex: '#6F8A72' },
  { id: 'forest', name: 'Verde Musgo', hex: '#384D3D' },
  { id: 'terracotta', name: 'Terracota Suave', hex: '#C46D53' },
  { id: 'ochre', name: 'Ocre Dourado', hex: '#C8984C' },
  { id: 'sand-stone', name: 'Bege Areia', hex: '#C7BEA5' },
  { id: 'slate-gray', name: 'Cinza Ardósia', hex: '#6C7380' },
  { id: 'charcoal', name: 'Preto Carvão', hex: '#22252B' },
];

export const PRINT_CATEGORIES: PrintCategory[] = [
  'Minimalistas',
  'Florais',
  'Abstratas',
  'Geométricas',
  'Natureza',
  'Artísticas',
  'Vintage',
  'Tipográficas',
  'Modernas',
];

export const PRINT_GALLERY: PrintTemplate[] = [
  { id: 'p-min-1', name: 'Traço Contínuo', category: 'Minimalistas', imageUrl: ARTWORK_SVGS.min_line_face },
  { id: 'p-min-2', name: 'Arco Horizonte', category: 'Minimalistas', imageUrl: ARTWORK_SVGS.min_arch_horizon },
  { id: 'p-flo-1', name: 'Ramo Botânico', category: 'Florais', imageUrl: ARTWORK_SVGS.floral_botanical_stem },
  { id: 'p-flo-2', name: 'Flores Silvestres', category: 'Florais', imageUrl: ARTWORK_SVGS.floral_wildflowers },
  { id: 'p-abs-1', name: 'Formas Orgânicas', category: 'Abstratas', imageUrl: ARTWORK_SVGS.abs_organic_shapes },
  { id: 'p-abs-2', name: 'Pinceladas Livres', category: 'Abstratas', imageUrl: ARTWORK_SVGS.abs_brush_strokes },
  { id: 'p-geo-1', name: 'Composição Bauhaus', category: 'Geométricas', imageUrl: ARTWORK_SVGS.geo_bauhaus_grid },
  { id: 'p-geo-2', name: 'Órbita Concêntrica', category: 'Geométricas', imageUrl: ARTWORK_SVGS.geo_concentric },
  { id: 'p-nat-1', name: 'Serra & Sol', category: 'Natureza', imageUrl: ARTWORK_SVGS.nat_mountain_sun },
  { id: 'p-nat-2', name: 'Folha Costela', category: 'Natureza', imageUrl: ARTWORK_SVGS.nat_monstera },
  { id: 'p-art-1', name: 'Recorte Atelier', category: 'Artísticas', imageUrl: ARTWORK_SVGS.art_matisse_cutout },
  { id: 'p-art-2', name: 'Vaso Terracota', category: 'Artísticas', imageUrl: ARTWORK_SVGS.art_terracotta_vase },
  { id: 'p-vin-1', name: 'Selo Atelier 2026', category: 'Vintage', imageUrl: ARTWORK_SVGS.vin_atelier_stamp },
  { id: 'p-vin-2', name: 'Ondas Retrô', category: 'Vintage', imageUrl: ARTWORK_SVGS.vin_retro_waves },
  { id: 'p-typ-1', name: 'Menos Plástico', category: 'Tipográficas', imageUrl: ARTWORK_SVGS.typ_less_plastic },
  { id: 'p-typ-2', name: 'Slow Living', category: 'Tipográficas', imageUrl: ARTWORK_SVGS.typ_slow_living },
  { id: 'p-mod-1', name: 'Anéis Cinéticos', category: 'Modernas', imageUrl: ARTWORK_SVGS.mod_kinetic_rings },
  { id: 'p-mod-2', name: 'Xadrez Urbano', category: 'Modernas', imageUrl: ARTWORK_SVGS.mod_checker_wave },
];

export const BOTTON_TEMPLATES: BottonTemplate[] = [
  { id: 'b-club', name: 'Inside Eco Club', imageUrl: ARTWORK_SVGS.botton_ucla_club, defaultBorderColor: '#DBD6BE' },
  { id: 'b-sun', name: 'Sol Amigável', imageUrl: ARTWORK_SVGS.botton_sun_smile, defaultBorderColor: '#181A1F' },
  { id: 'b-leaf', name: 'Folha Botânica', imageUrl: ARTWORK_SVGS.botton_botanical_badge, defaultBorderColor: '#DBD6BE' },
  { id: 'b-heart', name: 'Coração Craft', imageUrl: ARTWORK_SVGS.botton_heart_craft, defaultBorderColor: '#FFFFFF' },
  { id: 'b-mono', name: 'Monograma IE', imageUrl: ARTWORK_SVGS.botton_monogram, defaultBorderColor: '#536895' },
  { id: 'b-star', name: 'Estrela Azul', imageUrl: ARTWORK_SVGS.botton_eco_star, defaultBorderColor: '#181A1F' },
];

export const STUDIO_FONTS = [
  { id: 'Fraunces', label: 'Fraunces (Editorial)' },
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta (Moderna)' },
  { id: 'Playfair Display', label: 'Playfair (Clássica)' },
  { id: 'Cormorant Garamond', label: 'Cormorant (Elegante)' },
  { id: 'Outfit', label: 'Outfit (Geométrica)' },
  { id: 'Archivo', label: 'Archivo (Impacto)' },
  { id: 'Lora', label: 'Lora (Literária)' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono (Técnica)' },
];

export const CLIENT_DELIVERY_CONFIRMED_STATUS =
  'Entrega confirmada pelo cliente' as const;

export const ORDER_TIMELINE_STEPS: OrderTimelineStatus[] = [
  'Pedido recebido',
  'Análise da personalização',
  'Arte aguardando aprovação',
  'Arte aprovada',
  'Separação de materiais',
  'Em produção',
  'Inspeção de qualidade',
  'Embalagem',
  'Pronto para expedição',
  'Pedido expedido',
  'Em transporte',
  'Saiu para entrega',
  'Entregue',
];

export const COMPLAINT_REASONS: ComplaintReason[] = [
  'Defeito no produto',
  'Estampa incorreta',
  'Cor ou tamanho incorreto',
  'Danos no transporte',
  'Pedido incompleto',
  'Outros motivos',
];

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
