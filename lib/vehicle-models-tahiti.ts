import type { VehicleModel } from '@/lib/api';

type Category = 'citadine' | 'berline' | 'suv' | 'pickup' | 'utilitaire' | 'premium' | 'autre';
type Fuel = 'essence' | 'diesel' | 'hybride' | 'electrique';
type Transmission = 'auto' | 'manual';

type ModelDef = {
  id: string;
  name: string;
  category: Category;
  seats?: number;
  transmission?: Transmission;
  fuel?: Fuel;
};

function def(m: ModelDef): VehicleModel {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    imageUrl: null,
    description: null,
    seats: m.seats ?? 5,
    transmission: m.transmission ?? 'auto',
    fuel: m.fuel ?? 'essence',
    isActive: true,
    createdAt: '',
  };
}

/** Catalogue marques/modèles courants en Polynésie française (Tahiti & îles). */
const RAW: ModelDef[] = [
  // ─── Toyota (parc le plus répandu) ───
  { id: 'b-toyota-aygo', name: 'Toyota Aygo X', category: 'citadine' },
  { id: 'b-toyota-yaris', name: 'Toyota Yaris', category: 'citadine' },
  { id: 'b-toyota-yaris-cross', name: 'Toyota Yaris Cross', category: 'suv', fuel: 'hybride' },
  { id: 'b-toyota-agya', name: 'Toyota Agya', category: 'citadine' },
  { id: 'b-toyota-raize', name: 'Toyota Raize', category: 'suv' },
  { id: 'b-toyota-rush', name: 'Toyota Rush', category: 'suv', seats: 7 },
  { id: 'b-toyota-avanza', name: 'Toyota Avanza', category: 'utilitaire', seats: 7 },
  { id: 'b-toyota-corolla', name: 'Toyota Corolla', category: 'berline', fuel: 'hybride' },
  { id: 'b-toyota-corolla-cross', name: 'Toyota Corolla Cross', category: 'suv', fuel: 'hybride' },
  { id: 'b-toyota-camry', name: 'Toyota Camry', category: 'berline', fuel: 'hybride' },
  { id: 'b-toyota-prius', name: 'Toyota Prius', category: 'berline', fuel: 'hybride' },
  { id: 'b-toyota-chr', name: 'Toyota C-HR', category: 'suv', fuel: 'hybride' },
  { id: 'b-toyota-rav4', name: 'Toyota RAV4', category: 'suv', fuel: 'hybride' },
  { id: 'b-toyota-highlander', name: 'Toyota Highlander', category: 'suv', seats: 7, fuel: 'hybride' },
  { id: 'b-toyota-fortuner', name: 'Toyota Fortuner', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-toyota-prado', name: 'Toyota Land Cruiser Prado', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-toyota-landcruiser', name: 'Toyota Land Cruiser', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-toyota-fj', name: 'Toyota FJ Cruiser', category: 'suv', fuel: 'essence' },
  { id: 'b-toyota-hilux', name: 'Toyota Hilux', category: 'pickup', fuel: 'diesel' },
  { id: 'b-toyota-tacoma', name: 'Toyota Tacoma', category: 'pickup', fuel: 'essence' },
  { id: 'b-toyota-hiace', name: 'Toyota HiAce', category: 'utilitaire', seats: 8, fuel: 'diesel' },
  { id: 'b-toyota-coaster', name: 'Toyota Coaster', category: 'utilitaire', seats: 20, fuel: 'diesel' },
  { id: 'b-toyota-alphard', name: 'Toyota Alphard', category: 'utilitaire', seats: 7, fuel: 'hybride' },

  // ─── Lexus ───
  { id: 'b-lexus-ux', name: 'Lexus UX', category: 'premium', fuel: 'hybride' },
  { id: 'b-lexus-nx', name: 'Lexus NX', category: 'premium', fuel: 'hybride' },
  { id: 'b-lexus-rx', name: 'Lexus RX', category: 'premium', fuel: 'hybride' },
  { id: 'b-lexus-es', name: 'Lexus ES', category: 'premium', fuel: 'hybride' },
  { id: 'b-lexus-is', name: 'Lexus IS', category: 'premium' },

  // ─── Hyundai ───
  { id: 'b-hyundai-i10', name: 'Hyundai i10', category: 'citadine', transmission: 'manual' },
  { id: 'b-hyundai-i20', name: 'Hyundai i20', category: 'citadine' },
  { id: 'b-hyundai-accent', name: 'Hyundai Accent', category: 'berline' },
  { id: 'b-hyundai-elantra', name: 'Hyundai Elantra', category: 'berline' },
  { id: 'b-hyundai-sonata', name: 'Hyundai Sonata', category: 'berline' },
  { id: 'b-hyundai-venue', name: 'Hyundai Venue', category: 'suv' },
  { id: 'b-hyundai-creta', name: 'Hyundai Creta', category: 'suv' },
  { id: 'b-hyundai-kona', name: 'Hyundai Kona', category: 'suv' },
  { id: 'b-hyundai-tucson', name: 'Hyundai Tucson', category: 'suv' },
  { id: 'b-hyundai-santafe', name: 'Hyundai Santa Fe', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-hyundai-palisade', name: 'Hyundai Palisade', category: 'suv', seats: 7 },
  { id: 'b-hyundai-staria', name: 'Hyundai Staria', category: 'utilitaire', seats: 8, fuel: 'diesel' },
  { id: 'b-hyundai-h1', name: 'Hyundai H-1', category: 'utilitaire', seats: 8, fuel: 'diesel' },
  { id: 'b-hyundai-iload', name: 'Hyundai iLoad', category: 'utilitaire', seats: 3, fuel: 'diesel' },

  // ─── Kia ───
  { id: 'b-kia-picanto', name: 'Kia Picanto', category: 'citadine' },
  { id: 'b-kia-rio', name: 'Kia Rio', category: 'citadine' },
  { id: 'b-kia-cerato', name: 'Kia Cerato', category: 'berline' },
  { id: 'b-kia-k5', name: 'Kia K5', category: 'berline' },
  { id: 'b-kia-stonic', name: 'Kia Stonic', category: 'suv' },
  { id: 'b-kia-seltos', name: 'Kia Seltos', category: 'suv' },
  { id: 'b-kia-sportage', name: 'Kia Sportage', category: 'suv' },
  { id: 'b-kia-sorento', name: 'Kia Sorento', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-kia-carnival', name: 'Kia Carnival', category: 'utilitaire', seats: 8 },
  { id: 'b-kia-ev6', name: 'Kia EV6', category: 'premium', fuel: 'electrique' },

  // ─── Nissan ───
  { id: 'b-nissan-micra', name: 'Nissan Micra', category: 'citadine' },
  { id: 'b-nissan-almera', name: 'Nissan Almera', category: 'berline' },
  { id: 'b-nissan-sentra', name: 'Nissan Sentra', category: 'berline' },
  { id: 'b-nissan-juke', name: 'Nissan Juke', category: 'suv' },
  { id: 'b-nissan-qashqai', name: 'Nissan Qashqai', category: 'suv' },
  { id: 'b-nissan-xtrail', name: 'Nissan X-Trail', category: 'suv', seats: 7 },
  { id: 'b-nissan-pathfinder', name: 'Nissan Pathfinder', category: 'suv', seats: 7 },
  { id: 'b-nissan-terra', name: 'Nissan Terra', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-nissan-navara', name: 'Nissan Navara', category: 'pickup', fuel: 'diesel' },
  { id: 'b-nissan-patrol', name: 'Nissan Patrol', category: 'suv', seats: 7, fuel: 'essence' },
  { id: 'b-nissan-urvan', name: 'Nissan Urvan', category: 'utilitaire', seats: 12, fuel: 'diesel' },
  { id: 'b-nissan-nv200', name: 'Nissan NV200', category: 'utilitaire', seats: 5, fuel: 'essence' },
  { id: 'b-nissan-leaf', name: 'Nissan Leaf', category: 'berline', fuel: 'electrique' },

  // ─── Mitsubishi ───
  { id: 'b-mitsubishi-mirage', name: 'Mitsubishi Mirage', category: 'citadine' },
  { id: 'b-mitsubishi-attrage', name: 'Mitsubishi Attrage', category: 'berline' },
  { id: 'b-mitsubishi-asx', name: 'Mitsubishi ASX', category: 'suv' },
  { id: 'b-mitsubishi-eclipse', name: 'Mitsubishi Eclipse Cross', category: 'suv' },
  { id: 'b-mitsubishi-outlander', name: 'Mitsubishi Outlander', category: 'suv', seats: 7 },
  { id: 'b-mitsubishi-triton', name: 'Mitsubishi L200 Triton', category: 'pickup', fuel: 'diesel' },
  { id: 'b-mitsubishi-pajero', name: 'Mitsubishi Pajero', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-mitsubishi-pajero-sport', name: 'Mitsubishi Pajero Sport', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-mitsubishi-delica', name: 'Mitsubishi Delica', category: 'utilitaire', seats: 8, fuel: 'diesel' },

  // ─── Suzuki ───
  { id: 'b-suzuki-alto', name: 'Suzuki Alto', category: 'citadine', transmission: 'manual' },
  { id: 'b-suzuki-celerio', name: 'Suzuki Celerio', category: 'citadine' },
  { id: 'b-suzuki-swift', name: 'Suzuki Swift', category: 'citadine' },
  { id: 'b-suzuki-baleno', name: 'Suzuki Baleno', category: 'citadine' },
  { id: 'b-suzuki-ignis', name: 'Suzuki Ignis', category: 'citadine' },
  { id: 'b-suzuki-vitara', name: 'Suzuki Vitara', category: 'suv' },
  { id: 'b-suzuki-scross', name: 'Suzuki S-Cross', category: 'suv' },
  { id: 'b-suzuki-grand-vitara', name: 'Suzuki Grand Vitara', category: 'suv' },
  { id: 'b-suzuki-jimny', name: 'Suzuki Jimny', category: 'suv', seats: 4 },
  { id: 'b-suzuki-carry', name: 'Suzuki Carry', category: 'utilitaire', seats: 2, transmission: 'manual' },
  { id: 'b-suzuki-apv', name: 'Suzuki APV', category: 'utilitaire', seats: 8 },

  // ─── Honda ───
  { id: 'b-honda-jazz', name: 'Honda Jazz', category: 'citadine' },
  { id: 'b-honda-city', name: 'Honda City', category: 'berline' },
  { id: 'b-honda-civic', name: 'Honda Civic', category: 'berline' },
  { id: 'b-honda-accord', name: 'Honda Accord', category: 'berline' },
  { id: 'b-honda-hrv', name: 'Honda HR-V', category: 'suv' },
  { id: 'b-honda-brv', name: 'Honda BR-V', category: 'suv', seats: 7 },
  { id: 'b-honda-crv', name: 'Honda CR-V', category: 'suv' },
  { id: 'b-honda-pilot', name: 'Honda Pilot', category: 'suv', seats: 8 },
  { id: 'b-honda-odyssey', name: 'Honda Odyssey', category: 'utilitaire', seats: 8 },
  { id: 'b-honda-freed', name: 'Honda Freed', category: 'utilitaire', seats: 7 },

  // ─── Mazda ───
  { id: 'b-mazda2', name: 'Mazda 2', category: 'citadine' },
  { id: 'b-mazda3', name: 'Mazda 3', category: 'berline' },
  { id: 'b-mazda6', name: 'Mazda 6', category: 'berline' },
  { id: 'b-mazda-cx3', name: 'Mazda CX-3', category: 'suv' },
  { id: 'b-mazda-cx30', name: 'Mazda CX-30', category: 'suv' },
  { id: 'b-mazda-cx5', name: 'Mazda CX-5', category: 'suv' },
  { id: 'b-mazda-cx8', name: 'Mazda CX-8', category: 'suv', seats: 7 },
  { id: 'b-mazda-cx9', name: 'Mazda CX-9', category: 'suv', seats: 7 },
  { id: 'b-mazda-bt50', name: 'Mazda BT-50', category: 'pickup', fuel: 'diesel' },

  // ─── Ford ───
  { id: 'b-ford-fiesta', name: 'Ford Fiesta', category: 'citadine' },
  { id: 'b-ford-focus', name: 'Ford Focus', category: 'berline' },
  { id: 'b-ford-escape', name: 'Ford Escape', category: 'suv' },
  { id: 'b-ford-kuga', name: 'Ford Kuga', category: 'suv' },
  { id: 'b-ford-everest', name: 'Ford Everest', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-ford-ranger', name: 'Ford Ranger', category: 'pickup', fuel: 'diesel' },
  { id: 'b-ford-ranger-raptor', name: 'Ford Ranger Raptor', category: 'pickup', fuel: 'diesel' },
  { id: 'b-ford-transit', name: 'Ford Transit', category: 'utilitaire', seats: 3, fuel: 'diesel' },
  { id: 'b-ford-transit-custom', name: 'Ford Transit Custom', category: 'utilitaire', seats: 8, fuel: 'diesel' },

  // ─── Isuzu ───
  { id: 'b-isuzu-dmax', name: 'Isuzu D-Max', category: 'pickup', fuel: 'diesel' },
  { id: 'b-isuzu-mux', name: 'Isuzu MU-X', category: 'suv', seats: 7, fuel: 'diesel' },

  // ─── Subaru ───
  { id: 'b-subaru-impreza', name: 'Subaru Impreza', category: 'berline' },
  { id: 'b-subaru-xv', name: 'Subaru XV', category: 'suv' },
  { id: 'b-subaru-crosstrek', name: 'Subaru Crosstrek', category: 'suv' },
  { id: 'b-subaru-forester', name: 'Subaru Forester', category: 'suv' },
  { id: 'b-subaru-outback', name: 'Subaru Outback', category: 'suv' },

  // ─── Peugeot ───
  { id: 'b-peugeot-208', name: 'Peugeot 208', category: 'citadine' },
  { id: 'b-peugeot-308', name: 'Peugeot 308', category: 'berline' },
  { id: 'b-peugeot-408', name: 'Peugeot 408', category: 'berline' },
  { id: 'b-peugeot-2008', name: 'Peugeot 2008', category: 'suv' },
  { id: 'b-peugeot-3008', name: 'Peugeot 3008', category: 'suv' },
  { id: 'b-peugeot-5008', name: 'Peugeot 5008', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-peugeot-partner', name: 'Peugeot Partner', category: 'utilitaire', transmission: 'manual', fuel: 'diesel' },
  { id: 'b-peugeot-rifter', name: 'Peugeot Rifter', category: 'utilitaire', seats: 7, fuel: 'diesel' },
  { id: 'b-peugeot-expert', name: 'Peugeot Expert', category: 'utilitaire', seats: 3, fuel: 'diesel' },
  { id: 'b-peugeot-boxer', name: 'Peugeot Boxer', category: 'utilitaire', seats: 3, fuel: 'diesel' },

  // ─── Renault ───
  { id: 'b-renault-twingo', name: 'Renault Twingo', category: 'citadine' },
  { id: 'b-renault-clio', name: 'Renault Clio', category: 'citadine' },
  { id: 'b-renault-megane', name: 'Renault Mégane', category: 'berline' },
  { id: 'b-renault-captur', name: 'Renault Captur', category: 'suv' },
  { id: 'b-renault-arkana', name: 'Renault Arkana', category: 'suv' },
  { id: 'b-renault-austral', name: 'Renault Austral', category: 'suv' },
  { id: 'b-renault-scenic', name: 'Renault Scénic', category: 'utilitaire', seats: 7 },
  { id: 'b-renault-espace', name: 'Renault Espace', category: 'utilitaire', seats: 7 },
  { id: 'b-renault-kangoo', name: 'Renault Kangoo', category: 'utilitaire', transmission: 'manual', fuel: 'diesel' },
  { id: 'b-renault-trafic', name: 'Renault Trafic', category: 'utilitaire', seats: 9, fuel: 'diesel' },
  { id: 'b-renault-master', name: 'Renault Master', category: 'utilitaire', seats: 3, fuel: 'diesel' },
  { id: 'b-renault-alaskan', name: 'Renault Alaskan', category: 'pickup', fuel: 'diesel' },

  // ─── Citroën ───
  { id: 'b-citroen-c3', name: 'Citroën C3', category: 'citadine' },
  { id: 'b-citroen-c4', name: 'Citroën C4', category: 'berline' },
  { id: 'b-citroen-c3-aircross', name: 'Citroën C3 Aircross', category: 'suv' },
  { id: 'b-citroen-c5-aircross', name: 'Citroën C5 Aircross', category: 'suv' },
  { id: 'b-citroen-berlingo', name: 'Citroën Berlingo', category: 'utilitaire', transmission: 'manual', fuel: 'diesel' },
  { id: 'b-citroen-spacetourer', name: 'Citroën SpaceTourer', category: 'utilitaire', seats: 8, fuel: 'diesel' },
  { id: 'b-citroen-jumpy', name: 'Citroën Jumpy', category: 'utilitaire', seats: 3, fuel: 'diesel' },
  { id: 'b-citroen-jumper', name: 'Citroën Jumper', category: 'utilitaire', seats: 3, fuel: 'diesel' },

  // ─── Dacia ───
  { id: 'b-dacia-sandero', name: 'Dacia Sandero', category: 'citadine', transmission: 'manual' },
  { id: 'b-dacia-logan', name: 'Dacia Logan', category: 'berline', transmission: 'manual' },
  { id: 'b-dacia-duster', name: 'Dacia Duster', category: 'suv', transmission: 'manual' },
  { id: 'b-dacia-jogger', name: 'Dacia Jogger', category: 'utilitaire', seats: 7 },
  { id: 'b-dacia-spring', name: 'Dacia Spring', category: 'citadine', fuel: 'electrique' },

  // ─── Volkswagen ───
  { id: 'b-vw-polo', name: 'Volkswagen Polo', category: 'citadine' },
  { id: 'b-vw-golf', name: 'Volkswagen Golf', category: 'berline' },
  { id: 'b-vw-troc', name: 'Volkswagen T-Roc', category: 'suv' },
  { id: 'b-vw-tiguan', name: 'Volkswagen Tiguan', category: 'suv' },
  { id: 'b-vw-touareg', name: 'Volkswagen Touareg', category: 'premium', fuel: 'diesel' },
  { id: 'b-vw-amarok', name: 'Volkswagen Amarok', category: 'pickup', fuel: 'diesel' },
  { id: 'b-vw-caddy', name: 'Volkswagen Caddy', category: 'utilitaire', seats: 5, fuel: 'diesel' },
  { id: 'b-vw-transporter', name: 'Volkswagen Transporter', category: 'utilitaire', seats: 9, fuel: 'diesel' },
  { id: 'b-vw-california', name: 'Volkswagen California', category: 'utilitaire', seats: 4, fuel: 'diesel' },

  // ─── Fiat ───
  { id: 'b-fiat-500', name: 'Fiat 500', category: 'citadine', seats: 4 },
  { id: 'b-fiat-panda', name: 'Fiat Panda', category: 'citadine' },
  { id: 'b-fiat-tipo', name: 'Fiat Tipo', category: 'berline' },
  { id: 'b-fiat-500x', name: 'Fiat 500X', category: 'suv' },
  { id: 'b-fiat-doblo', name: 'Fiat Doblò', category: 'utilitaire', fuel: 'diesel' },
  { id: 'b-fiat-ducato', name: 'Fiat Ducato', category: 'utilitaire', seats: 3, fuel: 'diesel' },

  // ─── Daihatsu (encore présent sur le parc) ───
  { id: 'b-daihatsu-sirion', name: 'Daihatsu Sirion', category: 'citadine' },
  { id: 'b-daihatsu-terios', name: 'Daihatsu Terios', category: 'suv' },
  { id: 'b-daihatsu-rocky', name: 'Daihatsu Rocky', category: 'suv' },

  // ─── Chevrolet / Opel / Jeep (présence plus rare mais vue) ───
  { id: 'b-chevrolet-spark', name: 'Chevrolet Spark', category: 'citadine' },
  { id: 'b-chevrolet-trailblazer', name: 'Chevrolet Trailblazer', category: 'suv', seats: 7 },
  { id: 'b-chevrolet-colorado', name: 'Chevrolet Colorado', category: 'pickup', fuel: 'diesel' },
  { id: 'b-opel-corsa', name: 'Opel Corsa', category: 'citadine' },
  { id: 'b-opel-mokka', name: 'Opel Mokka', category: 'suv' },
  { id: 'b-jeep-renegade', name: 'Jeep Renegade', category: 'suv' },
  { id: 'b-jeep-compass', name: 'Jeep Compass', category: 'suv' },
  { id: 'b-jeep-wrangler', name: 'Jeep Wrangler', category: 'suv' },
  { id: 'b-jeep-grand-cherokee', name: 'Jeep Grand Cherokee', category: 'premium' },

  // ─── Mahindra / SsangYong ───
  { id: 'b-mahindra-pikup', name: 'Mahindra Pik Up', category: 'pickup', fuel: 'diesel' },
  { id: 'b-mahindra-scorpio', name: 'Mahindra Scorpio', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-ssangyong-korando', name: 'SsangYong Korando', category: 'suv' },
  { id: 'b-ssangyong-rexton', name: 'SsangYong Rexton', category: 'suv', seats: 7, fuel: 'diesel' },
  { id: 'b-ssangyong-musso', name: 'SsangYong Musso', category: 'pickup', fuel: 'diesel' },

  // ─── Premium ───
  { id: 'b-bmw-serie1', name: 'BMW Série 1', category: 'premium' },
  { id: 'b-bmw-serie3', name: 'BMW Série 3', category: 'premium' },
  { id: 'b-bmw-serie5', name: 'BMW Série 5', category: 'premium' },
  { id: 'b-bmw-x1', name: 'BMW X1', category: 'premium' },
  { id: 'b-bmw-x3', name: 'BMW X3', category: 'premium', fuel: 'diesel' },
  { id: 'b-bmw-x5', name: 'BMW X5', category: 'premium', fuel: 'diesel' },
  { id: 'b-mercedes-classea', name: 'Mercedes Classe A', category: 'premium' },
  { id: 'b-mercedes-classec', name: 'Mercedes Classe C', category: 'premium' },
  { id: 'b-mercedes-classee', name: 'Mercedes Classe E', category: 'premium' },
  { id: 'b-mercedes-gla', name: 'Mercedes GLA', category: 'premium' },
  { id: 'b-mercedes-glc', name: 'Mercedes GLC', category: 'premium' },
  { id: 'b-mercedes-gle', name: 'Mercedes GLE', category: 'premium', fuel: 'diesel' },
  { id: 'b-mercedes-vito', name: 'Mercedes Vito', category: 'utilitaire', seats: 8, fuel: 'diesel' },
  { id: 'b-mercedes-sprinter', name: 'Mercedes Sprinter', category: 'utilitaire', seats: 3, fuel: 'diesel' },
  { id: 'b-audi-a3', name: 'Audi A3', category: 'premium' },
  { id: 'b-audi-a4', name: 'Audi A4', category: 'premium' },
  { id: 'b-audi-q3', name: 'Audi Q3', category: 'premium' },
  { id: 'b-audi-q5', name: 'Audi Q5', category: 'premium' },
  { id: 'b-audi-q7', name: 'Audi Q7', category: 'premium', seats: 7 },
  { id: 'b-porsche-cayenne', name: 'Porsche Cayenne', category: 'premium' },
  { id: 'b-porsche-macan', name: 'Porsche Macan', category: 'premium' },
  { id: 'b-landrover-discovery', name: 'Land Rover Discovery', category: 'premium', seats: 7, fuel: 'diesel' },
  { id: 'b-landrover-defender', name: 'Land Rover Defender', category: 'premium', fuel: 'diesel' },
  { id: 'b-landrover-evoque', name: 'Land Rover Range Rover Evoque', category: 'premium' },
  { id: 'b-landrover-sport', name: 'Land Rover Range Rover Sport', category: 'premium' },
  { id: 'b-volvo-xc40', name: 'Volvo XC40', category: 'premium' },
  { id: 'b-volvo-xc60', name: 'Volvo XC60', category: 'premium' },
  { id: 'b-volvo-xc90', name: 'Volvo XC90', category: 'premium', seats: 7 },
  { id: 'b-tesla-model3', name: 'Tesla Model 3', category: 'premium', fuel: 'electrique' },
  { id: 'b-tesla-modely', name: 'Tesla Model Y', category: 'premium', fuel: 'electrique' },
];

export const TAHITI_VEHICLE_MODELS: VehicleModel[] = RAW.map(def);

export function extractBrand(name: string): string {
  const n = (name || '').trim();
  if (!n) return 'Autre';
  if (/^land\s+rover/i.test(n)) return 'Land Rover';
  if (/^ssangyong/i.test(n)) return 'SsangYong';
  if (/^alfa\s+romeo/i.test(n)) return 'Alfa Romeo';
  const first = n.split(/\s+/)[0];
  return first || 'Autre';
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Fusionne catalogue local Tahiti + modèles API (1 entrée par nom ; photo API prioritaire). */
export function mergeVehicleModels(apiModels: VehicleModel[], builtin = TAHITI_VEHICLE_MODELS): VehicleModel[] {
  const byName = new Map<string, VehicleModel>();

  for (const m of builtin) {
    if (!m?.name) continue;
    byName.set(normalizeName(m.name), m);
  }

  for (const m of apiModels) {
    if (!m?.name) continue;
    const key = normalizeName(m.name);
    const prev = byName.get(key);
    const preferId =
      (m.id?.startsWith('b-') && m.id) ||
      (prev?.id?.startsWith('b-') && prev.id) ||
      m.id ||
      prev?.id;
    byName.set(key, {
      ...(prev || m),
      ...m,
      id: preferId || m.id,
      imageUrl: m.imageUrl || prev?.imageUrl || null,
      isActive: m.isActive !== false,
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function listBrands(models: VehicleModel[]): string[] {
  const set = new Set(models.map((m) => extractBrand(m.name)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
}
