// Mode-Taxonomie: Kategorien, Farben, Materialien, Stile, Markenreputation (DE/EN/FR/IT-Schlüsselwörter).
import type { Category, Condition, Gender, Style } from './types';

export const CATEGORY_LABELS: Record<Category, string> = {
  tshirt: 'T-Shirts', top: 'Tops & Blusen', shirt: 'Hemden', polo: 'Polos', knit: 'Strick & Pullover',
  sweat: 'Sweats & Hoodies', jacket: 'Jacken', coat: 'Mäntel', blazer: 'Blazer & Sakkos', suit: 'Anzüge',
  vest: 'Westen & Gilets', trousers: 'Hosen', jeans: 'Jeans', shorts: 'Shorts', dress: 'Kleider',
  skirt: 'Röcke', jumpsuit: 'Overalls', shoes: 'Schuhe', boots: 'Stiefel & Boots', sneakers: 'Sneaker',
  sandals: 'Sandalen', bag: 'Taschen', accessory: 'Accessoires', underwear: 'Unterwäsche', socks: 'Socken',
  swim: 'Bademode', other: 'Sonstiges',
};

export const CATEGORY_GROUPS: { label: string; cats: Category[] }[] = [
  { label: 'Oberteile', cats: ['tshirt', 'top', 'shirt', 'polo', 'knit', 'sweat'] },
  { label: 'Jacken & Mäntel', cats: ['jacket', 'coat', 'blazer', 'vest', 'suit'] },
  { label: 'Hosen & Röcke', cats: ['trousers', 'jeans', 'shorts', 'skirt'] },
  { label: 'Kleider', cats: ['dress', 'jumpsuit'] },
  { label: 'Schuhe', cats: ['shoes', 'boots', 'sneakers', 'sandals'] },
  { label: 'Accessoires', cats: ['bag', 'accessory', 'underwear', 'socks', 'swim'] },
];

/** Outfit-Rollen je Kategorie */
export const OUTFIT_ROLE: Partial<Record<Category, 'top' | 'bottom' | 'outer' | 'shoes' | 'onepiece' | 'acc'>> = {
  tshirt: 'top', top: 'top', shirt: 'top', polo: 'top', knit: 'top', sweat: 'top',
  jacket: 'outer', coat: 'outer', blazer: 'outer', vest: 'outer',
  trousers: 'bottom', jeans: 'bottom', shorts: 'bottom', skirt: 'bottom',
  dress: 'onepiece', jumpsuit: 'onepiece', suit: 'onepiece',
  shoes: 'shoes', boots: 'shoes', sneakers: 'shoes', sandals: 'shoes',
  bag: 'acc', accessory: 'acc',
};

/** Reihenfolge: spezifisch vor allgemein. Muster werden als Wortanfang geprüft. */
export const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ['socks', ['sock', 'socks', 'socken', 'chaussette', 'calze', 'strumpf', 'strümpfe']],
  ['underwear', ['boxer', 'brief', 'briefs', 'trunk', 'trunks', 'underwear', 'unterwäsche', 'unterhose', 'bra', 'bralette', 'bh', 'hipster', 'thong', 'lingerie', 'undershirt', 'long johns', 'base layer', 'baselayer', 'pyjama', 'pajama', 'sleepwear', 'nightwear', 'loungewear set']],
  ['swim', ['swim', 'swimwear', 'bikini', 'swimsuit', 'badehose', 'badeanzug', 'bademode', 'maillot', 'swim short', 'board short', 'boardshort']],
  ['sneakers', ['zapatilla', 'zapatillas', 'sneaker', 'sneakers', 'trainer', 'trainers', 'runner', 'running shoe', 'turnschuh', 'court shoe', 'skate shoe', 'high top', 'low top']],
  ['boots', ['botas', 'botines', 'bota', 'boot', 'boots', 'stiefel', 'stiefelette', 'chelsea', 'bottes', 'bottine', 'stivali']],
  ['sandals', ['sandal', 'sandals', 'sandale', 'sandalen', 'slide', 'slides', 'flip flop', 'espadrille', 'mule', 'mules', 'clog', 'clogs']],
  ['shoes', ['zapato', 'zapatos', 'chaussures', 'scarpa', 'shoe', 'shoes', 'schuh', 'schuhe', 'loafer', 'loafers', 'derby', 'derbies', 'brogue', 'brogues', 'oxford shoe', 'monk strap', 'moccasin', 'mokassin', 'pump', 'pumps', 'heels', 'heel', 'ballerina', 'ballet flat', 'chaussure', 'scarpe', 'slipper', 'boat shoe', 'deck shoe', 'footwear']],
  ['bag', ['bag', 'bags', 'tasche', 'taschen', 'backpack', 'rucksack', 'tote', 'clutch', 'handbag', 'handtasche', 'shopper', 'crossbody', 'duffle bag', 'weekender', 'satchel', 'pouch', 'sac', 'borsa', 'messenger', 'bum bag', 'belt bag', 'hip bag', 'briefcase']],
  ['suit', ['suit', 'anzug', 'costume', 'tuxedo', 'smoking']],
  ['blazer', ['blazer', 'sport coat', 'sportcoat', 'sakko', 'suit jacket', 'veste de costume', 'giacca']],
  ['coat', ['abrigo', 'coat', 'mantel', 'manteau', 'cappotto', 'overcoat', 'topcoat', 'trench', 'trenchcoat', 'parka', 'duffle', 'duffel coat', 'peacoat', 'pea coat', 'raincoat', 'regenmantel', 'car coat', 'cocoon coat']],
  ['vest', ['chaleco', 'gilet', 'vest', 'weste', 'waistcoat', 'body warmer', 'bodywarmer', 'down vest', 'puffer vest']],
  ['jacket', ['chaqueta', 'cazadora', 'steppjacke', 'jacket', 'jacke', 'jacken', 'veste', 'blouson', 'bomber', 'overshirt', 'shacket', 'shirt jacket', 'chore', 'field jacket', 'harrington', 'windbreaker', 'anorak', 'shell jacket', 'softshell', 'hardshell', 'fleece jacket', 'puffer', 'down jacket', 'daunenjacke', 'trucker', 'denim jacket', 'jeansjacke', 'biker', 'lederjacke', 'leather jacket', 'coach jacket', 'track jacket', 'rain jacket', 'regenjacke', 'liner jacket']],
  ['jumpsuit', ['jumpsuit', 'overall', 'overalls', 'boiler suit', 'playsuit', 'romper', 'combinaison', 'dungaree', 'dungarees', 'latzhose']],
  ['dress', ['vestido', 'dress', 'kleid', 'kleider', 'robe', 'abito', 'gown', 'sundress', 'shirtdress', 'slip dress', 'midikleid', 'maxikleid', 'minikleid']],
  ['skirt', ['falda', 'skirt', 'rock', 'jupe', 'gonna', 'midirock', 'minirock', 'skort']],
  ['jeans', ['jeans', 'jean', 'denim pant', 'denim trouser', 'selvedge denim', 'raw denim', '5-pocket', 'five pocket']],
  ['shorts', ['shorts', 'bermuda', 'bermudas', 'kurze hose']],
  ['trousers', ['pantalón', 'pantalones', 'trouser', 'trousers', 'pant', 'pants', 'hose', 'hosen', 'chino', 'chinos', 'slacks', 'jogger', 'joggers', 'sweatpant', 'sweatpants', 'jogginghose', 'cargo', 'pantalon', 'pantaloni', 'legging', 'leggings', 'culotte', 'culottes', 'fatigue', 'fatigues', 'track pant', 'stoffhose', 'bundfaltenhose']],
  ['polo', ['polo', 'polos', 'poloshirt', 'rugby', 'rugby shirt']],
  ['sweat', ['sudadera', 'sweatshirt', 'sweat', 'hoodie', 'hoodies', 'hoody', 'hooded sweat', 'kapuzenpullover', 'zip hood', 'crewneck sweat', 'crew sweat', 'half zip sweat', 'sweatjacke', 'track top']],
  ['knit', ['jersey de punto', 'punto', 'sweater', 'sweaters', 'jumper', 'jumpers', 'pullover', 'pulli', 'cardigan', 'cardigans', 'knit', 'knitwear', 'knitted', 'strick', 'strickjacke', 'strickpullover', 'turtleneck', 'rollkragen', 'rollneck', 'roll neck', 'mock neck', 'crewneck knit', 'v-neck sweater', 'maglione', 'cable knit', 'zopfmuster', 'gansey', 'guernsey', 'fair isle']],
  ['tshirt', ['camiseta', 't-shirt', 't-shirts', 'tshirt', 'tshirts', 't shirt', 'tee', 'tees', 'longsleeve', 'long sleeve tee', 'langarmshirt', 'henley', 'raglan', 'pocket tee', 'graphic tee', 'tee-shirt']],
  ['shirt', ['camisa', 'shirt', 'shirts', 'hemd', 'hemden', 'chemise', 'camicia', 'oxford', 'button down', 'button-down', 'flannel', 'flanell', 'overshirt shirt', 'camp collar', 'bowling shirt', 'western shirt', 'chambray', 'popeline shirt', 'poplin shirt']],
  ['top', ['débardeur', 'caraco', 'top', 'tops', 'blouse', 'bluse', 'blusen', 'tank', 'tank top', 'camisole', 'cami', 'bodysuit', 'body', 'singlet', 'crop top', 'tunic', 'tunika', 'corset', 'bustier', 'vest top']],
  ['accessory', ['écharpe', 'bonnet', 'ceinture', 'gorro', 'bufanda', 'cinturón', 'scarf', 'schal', 'scarves', 'echarpe', 'beanie', 'mütze', 'muetze', 'cap', 'caps', 'hat', 'hats', 'hut', 'bucket hat', 'gloves', 'handschuhe', 'mittens', 'belt', 'gürtel', 'guertel', 'tie', 'ties', 'krawatte', 'bow tie', 'fliege', 'pocket square', 'einstecktuch', 'wallet', 'portemonnaie', 'geldbörse', 'card holder', 'cardholder', 'kartenetui', 'sunglasses', 'sonnenbrille', 'watch cap', 'headband', 'stirnband', 'bandana', 'snood', 'balaclava', 'earrings', 'necklace', 'bracelet', 'ring', 'jewellery', 'jewelry', 'schmuck', 'key ring', 'keychain', 'braces', 'suspenders', 'hosenträger', 'cufflinks', 'wrist warmers', 'neckerchief', 'shawl', 'stole', 'umbrella']],
];

/** Produkttypen, die keine Kleidung sind (werden aussortiert) */
export const EXCLUDE_KEYWORDS = [
  'gift card', 'giftcard', 'geschenkkarte', 'gutschein', 'voucher', 'e-gift', 'carte cadeau',
  'mug', 'tasse', 'poster', 'art print', 'book', 'buch', 'magazine', 'candle', 'kerze', 'sticker',
  'bottle', 'flasche', 'treemug', 'shipping protection', 'route package protection', 'insurance', 'versicherung',
  'donation', 'spende', 'sample', 'swatch', 'fabric sample', 'stoffmuster', 'care kit', 'pflegeset', 'shoe tree',
  'schuhspanner', 'shoe care', 'schuhpflege', 'shoe brush', 'bürste', 'lint', 'detergent', 'waschmittel',
  'blanket', 'decke', 'towel', 'handtuch', 'pillow', 'kissen', 'cushion', 'furniture', 'möbel', 'chair', 'stool',
  'lamp', 'plant', 'perfume', 'parfum', 'fragrance', 'soap', 'seife', 'cosmetic', 'repair service', 'reparatur',
  'alteration', 'monogram service', 'personalisation', 'test product', 'do not use', 'deposit', 'pfand',
  'bundle builder', 'mystery box', 'grab bag', 'wholesale', 'mindestbestellmenge', 'dog collar', 'dog lead', 'hundeleine',
  'spielzeug', 'phone case', 'laptop sleeve', 'notebook', 'umbrella stand', 'keyring holder', 'eulen-bag',
];

export const GENDER_KEYWORDS: [Gender, RegExp][] = [
  ['kids', /\b(kids?|children|child|kinder|kinderkleidung|baby|babies|toddler|junior|boys?|girls?|enfant|bambin[oi])\b/i],
  ['women', /\b(women|womens|women's|woman|womenswear|ladies|lady|damen|damenmode|frau|frauen|femme|femmes|donna|female|her|wmns|w's|womans)\b/i],
  ['men', /\b(men|mens|men's|man|menswear|herren|herrenmode|mann|männer|homme|hommes|uomo|male|him|m's|gents?)\b/i],
  ['unisex', /\b(unisex|genderless|gender neutral|all gender)\b/i],
];

export interface ColorDef { key: string; label: string; hex: string; words: string[]; family: 'neutral' | 'earth' | 'cool' | 'warm' | 'multi' }

export const COLORS: ColorDef[] = [
  { key: 'black', label: 'Schwarz', hex: '#111111', family: 'neutral', words: ['black', 'schwarz', 'noir', 'nero', 'negro', 'sort', 'svart', 'jet', 'onyx', 'charcoal black', 'raven', 'ink black', 'caviar'] },
  { key: 'white', label: 'Weiss', hex: '#fafafa', family: 'neutral', words: ['white', 'weiss', 'weiß', 'blanc', 'bianco', 'blanco', 'hvid', 'vit', 'optic white', 'snow', 'chalk'] },
  { key: 'ecru', label: 'Ecru & Creme', hex: '#efe7d6', family: 'neutral', words: ['crudo', 'ecru', 'écru', 'cream', 'creme', 'crème', 'off white', 'off-white', 'offwhite', 'ivory', 'elfenbein', 'natural', 'natur', 'undyed', 'non-dyed', 'oat', 'oatmeal', 'bone', 'vanilla', 'milk', 'porcelain', 'parchment', 'eggshell', 'stone white'] },
  { key: 'grey', label: 'Grau', hex: '#8d8d8d', family: 'neutral', words: ['grey', 'gray', 'grau', 'gris', 'grigio', 'grå', 'charcoal', 'anthrazit', 'anthracite', 'heather', 'melange', 'mélange', 'slate', 'graphite', 'ash', 'pewter', 'silver', 'silber', 'steel', 'smoke', 'dove', 'flint'] },
  { key: 'navy', label: 'Navy', hex: '#1f2a44', family: 'cool', words: ['navy', 'marine', 'dunkelblau', 'dark blue', 'midnight', 'bleu marine', 'blu navy', 'night', 'ink', 'indigo'] },
  { key: 'blue', label: 'Blau', hex: '#3a6ea5', family: 'cool', words: ['blue', 'blau', 'bleu', 'blu', 'azul', 'blå', 'cobalt', 'royal', 'denim', 'ocean', 'petrol', 'teal', 'steel blue', 'cornflower'] },
  { key: 'lightblue', label: 'Hellblau', hex: '#a9c6e2', family: 'cool', words: ['light blue', 'hellblau', 'sky', 'sky blue', 'baby blue', 'powder blue', 'pale blue', 'ice blue', 'bleu ciel', 'celeste', 'light indigo', 'stone wash', 'chambray', 'cloud blue'] },
  { key: 'green', label: 'Grün', hex: '#3f7d58', family: 'cool', words: ['caqui verde', 'green', 'grün', 'gruen', 'vert', 'verde', 'grøn', 'grön', 'forest', 'bottle green', 'emerald', 'mint', 'sage', 'pine', 'racing green', 'jade', 'moss', 'fern', 'seafoam', 'pistachio'] },
  { key: 'olive', label: 'Oliv', hex: '#6b6b3a', family: 'earth', words: ['olive', 'oliv', 'khaki green', 'military', 'army', 'loden', 'kaki', 'fatigue', 'hunter'] },
  { key: 'brown', label: 'Braun', hex: '#6b4a32', family: 'earth', words: ['marrón', 'brown', 'braun', 'marron', 'marrone', 'brun', 'chocolate', 'schoko', 'cognac', 'tobacco', 'tabak', 'espresso', 'coffee', 'mocha', 'chestnut', 'walnut', 'rust', 'rost', 'tan', 'bronze', 'cocoa', 'umber', 'caramel', 'whiskey', 'snuff', 'dark brown', 'mahogany', 'hazel', 'tortoise'] },
  { key: 'beige', label: 'Beige & Camel', hex: '#c8b08c', family: 'earth', words: ['arena', 'tostado', 'beige', 'camel', 'sand', 'khaki', 'stone', 'taupe', 'fawn', 'nude', 'biscuit', 'wheat', 'desert', 'dune', 'mushroom', 'greige', 'putty', 'latte', 'honey', 'tan beige', 'kitt'] },
  { key: 'red', label: 'Rot', hex: '#b3261e', family: 'warm', words: ['red', 'rot', 'rouge', 'rosso', 'rojo', 'rød', 'röd', 'scarlet', 'cherry', 'tomato', 'crimson', 'poppy', 'brick', 'chili', 'tangerine red', 'ruby'] },
  { key: 'burgundy', label: 'Bordeaux', hex: '#6d1f2f', family: 'warm', words: ['burdeos', 'granate', 'burgundy', 'bordeaux', 'wine', 'weinrot', 'maroon', 'oxblood', 'claret', 'merlot', 'plum', 'aubergine', 'cordovan', 'port'] },
  { key: 'pink', label: 'Rosa', hex: '#e7a1b0', family: 'warm', words: ['pink', 'rosa', 'rose', 'rosé', 'blush', 'fuchsia', 'magenta', 'salmon', 'lachs', 'coral', 'koralle', 'peach', 'dusty rose', 'raspberry', 'bubblegum'] },
  { key: 'purple', label: 'Violett', hex: '#6b4c8a', family: 'cool', words: ['morado', 'purple', 'violett', 'violet', 'lila', 'lilac', 'lavender', 'lavendel', 'mauve', 'viola', 'grape', 'orchid', 'amethyst'] },
  { key: 'yellow', label: 'Gelb', hex: '#e2b93b', family: 'warm', words: ['yellow', 'gelb', 'jaune', 'giallo', 'amarillo', 'gul', 'mustard', 'senf', 'lemon', 'ochre', 'ocker', 'gold', 'butter', 'canary', 'saffron', 'sunflower'] },
  { key: 'orange', label: 'Orange', hex: '#e07a2f', family: 'warm', words: ['orange', 'arancione', 'naranja', 'tangerine', 'apricot', 'aprikose', 'pumpkin', 'burnt orange', 'terracotta', 'sienna', 'copper', 'kupfer', 'amber', 'clementine'] },
  { key: 'multi', label: 'Mehrfarbig & Muster', hex: 'linear-gradient(135deg,#e07a2f,#3a6ea5,#3f7d58)', family: 'multi', words: ['multi', 'multicolour', 'multicolor', 'mehrfarbig', 'stripe', 'striped', 'gestreift', 'check', 'kariert', 'plaid', 'tartan', 'print', 'printed', 'floral', 'pattern', 'camo', 'camouflage', 'paisley', 'gingham', 'houndstooth', 'leopard', 'tie dye', 'patchwork', 'jacquard', 'fair isle', 'breton'] },
];

export const COLOR_BY_KEY = Object.fromEntries(COLORS.map((c) => [c.key, c]));

/** Material: Qualitätswert 0–100 (Langlebigkeit, Tragekomfort, Wertigkeit) */
export interface MaterialDef { key: string; label: string; value: number; words: string[]; natural: boolean; group: 'wool' | 'plant' | 'animal' | 'synthetic' | 'cellulose' | 'leather' | 'other' }

export const MATERIALS: MaterialDef[] = [
  { key: 'cashmere', label: 'Kaschmir', value: 94, natural: true, group: 'wool', words: ['cashmere', 'kaschmir', 'cachemire', 'cashmir'] },
  { key: 'vicuna', label: 'Vikunja', value: 99, natural: true, group: 'wool', words: ['vicuna', 'vicuña', 'vikunja'] },
  { key: 'camelhair', label: 'Kamelhaar', value: 90, natural: true, group: 'wool', words: ['camel hair', 'camelhair', 'kamelhaar'] },
  { key: 'alpaca', label: 'Alpaka', value: 90, natural: true, group: 'wool', words: ['alpaca', 'alpaka', 'baby alpaca'] },
  { key: 'mohair', label: 'Mohair', value: 86, natural: true, group: 'wool', words: ['mohair'] },
  { key: 'yak', label: 'Yak', value: 90, natural: true, group: 'wool', words: ['yak'] },
  { key: 'merino', label: 'Merinowolle', value: 90, natural: true, group: 'wool', words: ['merino', 'merinowolle', 'extrafine merino', 'extra fine merino', 'superfine merino'] },
  { key: 'lambswool', label: 'Lammwolle', value: 86, natural: true, group: 'wool', words: ['lambswool', 'lamb wool', 'lammwolle', "lamb's wool"] },
  { key: 'wool', label: 'Wolle', value: 84, natural: true, group: 'wool', words: ['wool', 'wolle', 'schurwolle', 'virgin wool', 'laine', 'lana', 'shetland', 'tweed', 'boiled wool', 'walkwolle', 'loden', 'flannel wool', 'worsted', 'uld'] },
  { key: 'silk', label: 'Seide', value: 86, natural: true, group: 'animal', words: ['silk', 'seide', 'soie', 'seta', 'mulberry silk'] },
  { key: 'linen', label: 'Leinen', value: 85, natural: true, group: 'plant', words: ['linen', 'leinen', 'lino', 'flax', 'hør'] },
  { key: 'hemp', label: 'Hanf', value: 82, natural: true, group: 'plant', words: ['hemp', 'hanf', 'chanvre'] },
  { key: 'supima', label: 'Supima-/Pima-Baumwolle', value: 84, natural: true, group: 'plant', words: ['supima', 'pima', 'sea island cotton', 'giza cotton', 'egyptian cotton', 'ägyptische baumwolle', 'long staple', 'extra long staple'] },
  { key: 'organic_cotton', label: 'Bio-Baumwolle', value: 76, natural: true, group: 'plant', words: ['organic cotton', 'bio-baumwolle', 'biobaumwolle', 'bio baumwolle', 'coton bio', 'cotone biologico', 'organic-cotton', 'gots cotton', 'økologisk bomuld'] },
  { key: 'recycled_cotton', label: 'Recycelte Baumwolle', value: 66, natural: true, group: 'plant', words: ['recycled cotton', 'recycelte baumwolle', 'coton recyclé'] },
  { key: 'cotton', label: 'Baumwolle', value: 70, natural: true, group: 'plant', words: ['cotton', 'baumwolle', 'coton', 'cotone', 'algodón', 'bomuld', 'bomull', 'denim', 'canvas', 'twill', 'corduroy', 'cord', 'oxford cloth', 'poplin', 'popeline', 'jersey cotton', 'seersucker', 'moleskin', 'chambray', 'piqué', 'pique', 'terry', 'frottee', 'french terry', 'fleece cotton', 'loopback'] },
  { key: 'lyocell', label: 'Lyocell (Tencel)', value: 72, natural: false, group: 'cellulose', words: ['lyocell', 'tencel'] },
  { key: 'cupro', label: 'Cupro', value: 70, natural: false, group: 'cellulose', words: ['cupro', 'bemberg'] },
  { key: 'modal', label: 'Modal', value: 64, natural: false, group: 'cellulose', words: ['modal'] },
  { key: 'viscose', label: 'Viskose', value: 50, natural: false, group: 'cellulose', words: ['viscose', 'viskose', 'rayon', 'ecovero', 'livaeco'] },
  { key: 'down', label: 'Daunen', value: 86, natural: true, group: 'animal', words: ['daunen', 'goose down', 'duck down', 'down fill', 'down-filled', 'down filled', 'gänsedaunen', 'entendaunen', 'rds down', 'fill power'] },
  { key: 'fullgrain', label: 'Vollnarbenleder', value: 95, natural: true, group: 'leather', words: ['full grain', 'full-grain', 'vollnarben', 'vollnarbig', 'shell cordovan', 'cordovan leather', 'vegetable tanned', 'veg-tan', 'pflanzlich gegerbt', 'bridle leather'] },
  { key: 'leather', label: 'Leder', value: 82, natural: true, group: 'leather', words: ['leather', 'leder', 'cuir', 'pelle', 'calfskin', 'kalbsleder', 'lambskin', 'lammleder', 'nappa', 'cowhide', 'rindleder', 'goatskin', 'deerskin', 'horsehide', 'patent leather', 'lackleder', 'calf leather'] },
  { key: 'suede', label: 'Wildleder', value: 78, natural: true, group: 'leather', words: ['suede', 'wildleder', 'veloursleder', 'daim', 'scamosciato', 'nubuck', 'nubuk'] },
  { key: 'shearling', label: 'Lammfell', value: 88, natural: true, group: 'leather', words: ['shearling', 'lammfell', 'sheepskin', 'schaffell'] },
  { key: 'goretex', label: 'GORE-TEX', value: 90, natural: false, group: 'synthetic', words: ['gore-tex', 'goretex', 'gore tex', 'ventile', 'event membrane', 'sympatex'] },
  { key: 'recycled_nylon', label: 'Recyceltes Nylon', value: 60, natural: false, group: 'synthetic', words: ['recycled nylon', 'recycled polyamide', 'econyl', 'recyceltes nylon', 'recyceltes polyamid'] },
  { key: 'nylon', label: 'Nylon/Polyamid', value: 56, natural: false, group: 'synthetic', words: ['nylon', 'polyamide', 'polyamid', 'cordura', 'ripstop nylon'] },
  { key: 'recycled_polyester', label: 'Recyceltes Polyester', value: 50, natural: false, group: 'synthetic', words: ['recycled polyester', 'recyceltes polyester', 'repreve', 'rpet', 'polyester recyclé'] },
  { key: 'polyester', label: 'Polyester', value: 40, natural: false, group: 'synthetic', words: ['polyester', 'poliestere'] },
  { key: 'elastane', label: 'Elasthan', value: 50, natural: false, group: 'synthetic', words: ['elastane', 'elasthan', 'spandex', 'lycra', 'elastan', 'elastomultiester'] },
  { key: 'acrylic', label: 'Polyacryl', value: 22, natural: false, group: 'synthetic', words: ['acrylic', 'acryl', 'polyacryl', 'polyacrylic', 'acrilico'] },
  { key: 'pu', label: 'Kunstleder (PU)', value: 25, natural: false, group: 'synthetic', words: ['polyurethane', 'pu leather', 'faux leather', 'vegan leather', 'kunstleder', 'pleather'] },
  { key: 'rubber', label: 'Gummi', value: 60, natural: true, group: 'other', words: ['rubber', 'gummi', 'vibram', 'dainite', 'crepe sole', 'kreppsohle'] },
];

export const MATERIAL_BY_KEY = Object.fromEntries(MATERIALS.map((m) => [m.key, m]));

export const STYLE_LABELS: Record<Style, string> = {
  minimal: 'Minimalistisch', classic: 'Klassisch', smart: 'Smart Casual', casual: 'Casual',
  streetwear: 'Streetwear', workwear: 'Workwear', outdoor: 'Outdoor', sporty: 'Sportlich',
  preppy: 'Preppy', elegant: 'Elegant', vintage: 'Vintage', boho: 'Boho', avantgarde: 'Avantgarde',
};

export const STYLE_KEYWORDS: [Style, string[]][] = [
  ['minimal', ['minimal', 'minimalist', 'essential', 'essentials', 'clean', 'basic', 'plain', 'timeless', 'capsule', 'pure', 'understated']],
  ['classic', ['classic', 'klassisch', 'heritage', 'tailored', 'oxford', 'loafer', 'trench', 'cable knit', 'tweed', 'brogue', 'derby', 'chino']],
  ['smart', ['smart', 'smart casual', 'business', 'office', 'blazer', 'polo knit', 'merino polo', 'pleated trouser', 'bundfalte', 'overshirt']],
  ['casual', ['casual', 'everyday', 'relaxed', 'lounge', 'weekend', 'tee', 'sweatshirt', 'hoodie']],
  ['streetwear', ['streetwear', 'street', 'graphic', 'oversized', 'skate', 'logo', 'hype', 'urban', 'cargo', 'puffer', 'baggy']],
  ['workwear', ['workwear', 'work', 'chore', 'carpenter', 'utility', 'selvedge', 'raw denim', 'duck canvas', 'painter', 'boiler suit', 'workshirt', 'engineer']],
  ['outdoor', ['outdoor', 'hiking', 'wandern', 'trail', 'mountain', 'berg', 'gorpcore', 'fleece', 'shell', 'gore-tex', 'waterproof', 'wasserdicht', 'technical', 'alpine', 'parka', 'all weather']],
  ['sporty', ['sport', 'sporty', 'athletic', 'athleisure', 'running', 'training', 'gym', 'tennis', 'activewear', 'track']],
  ['preppy', ['preppy', 'rugby', 'ivy', 'varsity', 'cricket', 'button-down', 'button down', 'boat shoe', 'cable', 'regatta', 'collegiate']],
  ['elegant', ['elegant', 'evening', 'silk', 'satin', 'cocktail', 'formal', 'dressy', 'heels', 'gown', 'tuxedo', 'luxury', 'luxurious']],
  ['vintage', ['vintage', 'retro', '70s', '80s', '90s', '1970s', '1980s', '1990s', 'y2k', 'archive', 'deadstock', 'pre-owned', 'preloved', 'secondhand']],
  ['boho', ['boho', 'bohemian', 'floral', 'crochet', 'häkel', 'peasant', 'embroidered', 'paisley', 'fringe', 'tiered']],
  ['avantgarde', ['avant-garde', 'avantgarde', 'deconstructed', 'asymmetric', 'asymmetrical', 'sculptural', 'draped', 'experimental']],
];

/** Qualitätsmerkmale aus Beschreibungen: [Code, Label, Punkte (Verarbeitung), Regex] */
export const FEATURE_RULES: [string, string, number, RegExp][] = [
  ['selvedge', 'Selvedge-Denim/Webkante', 6, /\b(selvedge|selvage|webkante)\b/i],
  ['goodyear', 'Goodyear-rahmengenäht', 9, /good\s?year|rahmengenäht|rahmen-genäht|welted/i],
  ['blake', 'Blake-genäht', 5, /\bblake[\s-]?(stitch|rapid|construction|genäht)/i],
  ['resole', 'Neu besohlbar', 4, /re-?sol(e|able|ing)|neu besohl|wiederbesohl/i],
  ['handmade', 'Handgefertigt', 5, /\b(hand[\s-]?made|handgefertigt|handcrafted|hand[\s-]?finished|hand[\s-]?sewn|handgenäht|fait main|fatto a mano)\b/i],
  ['fullyfashioned', 'Fully Fashioned gestrickt', 4, /fully[\s-]?fashioned|formgestrickt/i],
  ['flatfelled', 'Kappnähte', 3, /flat[\s-]?felled|kappnaht|kappnähte/i],
  ['frenchseams', 'Französische Nähte', 3, /french seams?|französische naht/i],
  ['chainstitch', 'Kettenstich', 3, /chain[\s-]?stitch|kettenstich/i],
  ['reinforced', 'Verstärkte Nähte', 3, /reinforced|bar[\s-]?tack|triple[\s-]?stitch|double[\s-]?stitch|verstärkt|riegel/i],
  ['canvas', 'Rosshaar-/Canvas-Einlage', 6, /(full|half)[\s-]?canvas|rosshaar|floating canvas/i],
  ['horn', 'Horn-/Perlmuttknöpfe', 2, /horn buttons?|hornknöpf|mother[\s-]of[\s-]pearl|perlmutt|corozo|steinnuss/i],
  ['zip', 'Premium-Reissverschluss (YKK/Riri)', 2, /\b(ykk|riri|lampo)\b/i],
  ['loopwheel', 'Loopwheel/Rundstrick', 4, /loop[\s-]?wheel|tubular knit|rundgestrickt|schlauchware/i],
  ['twoply', 'Zweifach gezwirnt', 3, /\b(2|two)[\s-]?ply\b|zweifach gezwirnt|2-fädig/i],
  ['heavyweight', 'Schwerer Stoff', 3, /heavy[\s-]?weight|heavyweight|schwere qualität|dicker stoff/i],
  ['preshrunk', 'Vorgewaschen/Sanforisiert', 2, /pre[\s-]?shrunk|sanfori[sz]ed|vorgewaschen|garment[\s-]?washed/i],
  ['italianfabric', 'Italienischer Stoff', 3, /italian (yarn|fabric|wool|mill|cloth)|italienische[rsn]? (garn|stoff|wolle)|loro piana|zegna|vitale barberis|reda|marzotto|cerruti|albini|canclini|thomas mason|tollegno|zegna baruffa|botto giuseppe|cariaggi/i],
  ['japanesefabric', 'Japanischer Stoff', 4, /japanese (denim|fabric|selvedge|cotton|mill)|japanischer (stoff|denim)|kaihara|kuroki|nihon menpu|collect mills|okayama|kojima/i],
  ['britishcloth', 'Britisches Tuch', 3, /british millerain|halley stevensons|fox brothers|abraham moon|harris tweed|johnstons of elgin|joshua ellis|ventile|lovat/i],
  ['wovenlabel', 'Garment dyed', 1, /garment[\s-]?dyed|stückgefärbt|piece[\s-]?dyed/i],
  ['repair', 'Reparaturservice/Garantie', 4, /lifetime (repair|warranty|guarantee)|free repairs?|kostenlose reparatur|repair service|lebenslange garantie|lifetime guarantee/i],
  ['mulesingfree', 'Mulesing-frei', 2, /mulesing[\s-]?free|mulesing[\s-]?frei|non-mulesed|ohne mulesing/i],
];

export const CERT_RULES: [string, string, RegExp][] = [
  ['gots', 'GOTS', /\bgots\b|global organic textile/i],
  ['oekotex', 'OEKO-TEX', /oeko[\s-]?tex|öko[\s-]?tex/i],
  ['bluesign', 'bluesign', /bluesign/i],
  ['fairwear', 'Fair Wear', /fair wear/i],
  ['fairtrade', 'Fairtrade', /fair[\s-]?trade/i],
  ['bcorp', 'B Corp', /\bb[\s-]?corp/i],
  ['rws', 'RWS', /\brws\b|responsible wool/i],
  ['rds', 'RDS', /\brds\b|responsible down/i],
  ['grs', 'GRS', /\bgrs\b|global recycled standard/i],
  ['lwg', 'Leather Working Group', /leather working group|\blwg\b/i],
  ['c2c', 'Cradle to Cradle', /cradle to cradle/i],
];

export const ORIGINS: [string, string, number, RegExp][] = [
  // [Code, Label, Punkte, Regex]
  ['ch', 'Schweiz', 8, /made in switzerland|hergestellt in der schweiz|swiss made|gefertigt in der schweiz|produziert in der schweiz/i],
  ['it', 'Italien', 8, /made in italy|hergestellt in italien|fabriqué en italie|prodotto in italia|italian made|in italien gefertigt/i],
  ['jp', 'Japan', 8, /made in japan|hergestellt in japan|in japan gefertigt/i],
  ['pt', 'Portugal', 7, /made in portugal|hergestellt in portugal|in portugal gefertigt|fabriqué au portugal|produced in portugal/i],
  ['uk', 'Grossbritannien', 7, /made in (england|scotland|britain|great britain|the uk|uk|wales|northern ireland)|hergestellt in (england|schottland)|british made|scottish made/i],
  ['fr', 'Frankreich', 7, /made in france|fabriqué en france|hergestellt in frankreich/i],
  ['de', 'Deutschland', 7, /made in germany|hergestellt in deutschland|in deutschland gefertigt/i],
  ['at', 'Österreich', 7, /made in austria|hergestellt in österreich/i],
  ['es', 'Spanien', 6, /made in spain|hecho en españa|hergestellt in spanien/i],
  ['us', 'USA', 6, /made in (the )?usa|made in america|made in the u\.s\.a?\.?/i],
  ['ca', 'Kanada', 6, /made in canada/i],
  ['eu', 'EU', 5, /made in (the )?(eu|europe)|hergestellt in (der )?(eu|europa)|european made/i],
  ['lt', 'Litauen', 5, /made in lithuania/i],
  ['pe', 'Peru', 5, /made in peru/i],
  ['tr', 'Türkei', 4, /made in (turkey|türkiye)|hergestellt in der türkei/i],
  ['ro', 'Rumänien', 5, /made in romania/i],
  ['bg', 'Bulgarien', 5, /made in bulgaria/i],
  ['pl', 'Polen', 5, /made in poland/i],
  ['in', 'Indien', 3, /made in india/i],
  ['cn', 'China', 3, /made in china/i],
  ['vn', 'Vietnam', 3, /made in vietnam/i],
  ['bd', 'Bangladesch', 3, /made in bangladesh/i],
];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: 'Neu', nwt: 'Neu mit Etikett', excellent: 'Ausgezeichnet', very_good: 'Sehr gut', good: 'Gut', fair: 'Getragen',
};

export const CONDITION_POINTS: Record<Condition, number> = { new: 15, nwt: 15, excellent: 13, very_good: 11, good: 8, fair: 4 };

export const CONDITION_RULES: [Condition, RegExp][] = [
  ['nwt', /new with tags|neu mit etikett|nwt|brand new|neu mit preisschild|new with box|nwb|unworn with tags|5-star|deadstock/i],
  ['excellent', /\bexcellent\b|ausgezeichnet|like new|wie neu|mint|neuwertig|pristine|4-star|grade 1\b|never worn|unworn/i],
  ['very_good', /very good|sehr gut|grade 2\b|great condition|3\.5-star/i],
  ['good', /\bgood\b|\bgut\b|grade 3\b|3-star|gently used|light wear/i],
  ['fair', /\bfair\b|well worn|signs of wear|gebrauchsspuren|grade [45]\b|2-star|1-star|vintage wear|distressed/i],
];

/**
 * Kuratierte Markenreputation (1–5) für Multi-Brand- und Secondhand-Shops.
 * 5 = herausragende Materialien/Verarbeitung, 3 = solide, 1 = Fast Fashion.
 * Bewusst konservativ; Grundlage: Fachpresse, Herstellungsland, Material und Langlebigkeit.
 */
export const BRAND_TIERS: Record<string, number> = {
  // Luxus/Atelier
  'brunello cucinelli': 5, 'loro piana': 5, 'hermès': 5, hermes: 5, 'the row': 5, 'bottega veneta': 5, zegna: 5,
  'ermenegildo zegna': 5, kiton: 5, brioni: 5, 'tom ford': 5, 'saint laurent': 4, 'yves saint laurent': 4,
  chanel: 5, dior: 4, 'christian dior': 4, 'louis vuitton': 4, celine: 4, céline: 4, prada: 4, gucci: 4, loewe: 5,
  'max mara': 5, khaite: 4, 'jil sander': 5, lemaire: 5, 'acne studios': 4, 'dries van noten': 5, 'maison margiela': 4,
  'issey miyake': 4, 'comme des garçons': 4, 'comme des garcons': 4, 'yohji yamamoto': 5, burberry: 4, 'giorgio armani': 4,
  armani: 3, valentino: 4, fendi: 4, balenciaga: 3, givenchy: 4, 'alexander mcqueen': 4, chloé: 4, chloe: 4,
  'miu miu': 4, 'stella mccartney': 4, moncler: 4, 'canada goose': 4, 'stone island': 4, 'c.p. company': 4,
  'cp company': 4, totême: 4, toteme: 4, 'our legacy': 4, auralee: 5, 'margaret howell': 5, 'a.p.c.': 4, apc: 4,
  'ralph lauren': 3, 'polo ralph lauren': 3, 'purple label': 5, barbour: 4, 'john smedley': 5, sunspel: 5,
  'drake\'s': 5, drakes: 5, 'private white v.c.': 5, 'private white': 5, 'norse projects': 4, 'universal works': 4,
  'oliver spencer': 4, 'merz b. schwanen': 5, 'merz b schwanen': 5, 'colorful standard': 4, 'sheep inc': 4,
  'jumper 1234': 4, 'portuguese flannel': 4, 'taylor stitch': 4, 'freenote cloth': 5, 'alex mill': 4, naadam: 4,
  'wool&': 3, 'unbound merino': 3, 'knowledge cotton apparel': 3, knowledgecotton: 3, armedangels: 3, nikin: 3,
  qwstion: 4, rotauf: 4, muntagnard: 4, ecoalf: 3, 'thinking mu': 3, 'kings of indigo': 3, 'mud jeans': 3,
  'organic basics': 3, snocks: 2, pangaia: 3, kotn: 3, outerknown: 3, 'mads nørgaard': 3, 'mads norgaard': 3,
  'a kind of guise': 4, langbrett: 3, 'armor-lux': 3, 'armor lux': 3, 'saint james': 4, hast: 4, rouje: 3,
  bonnegueule: 4, 'paloma wool': 3, folk: 4, 'wax london': 3, percival: 3, 'r e tricker ltd': 5, "tricker's": 5,
  trickers: 5, uskees: 3, 'thursday boot company': 3, 'ace marks': 4, koio: 4, myrqvist: 4, 'mott & bow': 3,
  kith: 3, patagonia: 4, "arc'teryx": 5, arcteryx: 5, 'the north face': 3, 'mammut': 4, 'fjällräven': 4,
  fjallraven: 4, 'filson': 5, 'red wing': 5, 'red wing shoes': 5, 'dr. martens': 3, 'dr martens': 3, 'church\'s': 5,
  churchs: 5, 'crockett & jones': 5, 'edward green': 5, 'john lobb': 5, 'alden': 5, 'paraboot': 5, 'j.m. weston': 5,
  birkenstock: 4, veja: 3, 'common projects': 4, 'new balance': 3, 'levi\'s': 3, levis: 3, "levi's vintage clothing": 4,
  lee: 2, wrangler: 2, carhartt: 3, 'carhartt wip': 3, dickies: 2, 'l.l.bean': 3, 'll bean': 3, pendleton: 4,
  'woolrich': 3, 'schott': 4, 'belstaff': 4, "barbour international": 3, 'lacoste': 3, 'fred perry': 3,
  'tommy hilfiger': 2, 'calvin klein': 2, 'hugo boss': 3, boss: 3, 'massimo dutti': 2, cos: 2, arket: 2,
  'uniqlo': 2, 'zara': 1, 'h&m': 1, mango: 1, 'shein': 1, 'primark': 1, 'asos': 1, 'bershka': 1, 'pull&bear': 1,
  'gap': 2, 'burocs': 2, 'nike': 3, 'adidas': 3, 'puma': 2, 'reebok': 2, 'converse': 2, 'vans': 2, 'champion': 2,
  'oakley': 3, 'columbia': 3, 'helly hansen': 3, 'coogi': 3, 'pringle of scotland': 4, 'pringle': 4,
  'aquascutum': 4, 'daks': 4, 'jaeger': 3, 'austin reed': 3, 'diesel': 2, 'guess': 2, 'esprit': 2,
  'versace': 4, 'moschino': 3, 'dolce & gabbana': 4, 'vivienne westwood': 4, 'kenzo': 3, 'marni': 4,
  'isabel marant': 4, 'ganni': 3, 'sandro': 3, 'maje': 3, 'reformation': 3, 'sézane': 3, 'sezane': 3,
  'the frankie shop': 3, 'nanushka': 3, 'by malene birger': 3, 'filippa k': 4, 'samsøe samsøe': 3, 'arket ': 2,
  'acne': 4, 'ami paris': 4, 'ami': 3, 'maison kitsuné': 3, 'maison kitsune': 3, 'wood wood': 3, 'han kjøbenhavn': 3,
  'stüssy': 3, stussy: 3, supreme: 3, palace: 3, 'aimé leon dore': 4, 'aime leon dore': 4, 'noah': 4, 'beams plus': 4,
  'engineered garments': 5, 'kapital': 5, 'visvim': 5, 'needles': 4, 'nanamica': 4, 'snow peak': 4, 'and wander': 4,
  'goldwin': 4, 'salomon': 4, 'hoka': 3, 'on': 3, 'asics': 3, 'mizuno': 3, 'birkenstock 1774': 4,
};

export const SIZE_ORDER = ['XXXS', '3XS', 'XXS', '2XS', 'XS', 'XS/S', 'S', 'S/M', 'M', 'M/L', 'L', 'L/XL', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', 'ONE SIZE', 'OS'];

export const FIT_KEYWORDS: [string, RegExp][] = [
  ['slim', /\b(slim|skinny|tapered|fitted|tailliert|schmal)\b/i],
  ['regular', /\b(regular|classic fit|straight|gerade|normal fit)\b/i],
  ['relaxed', /\b(relaxed|loose|wide|weit|baggy|boxy|oversized?|easy fit|comfort fit)\b/i],
];

export const FIT_LABELS: Record<string, string> = { slim: 'Schmal', regular: 'Regular', relaxed: 'Locker / Oversized' };
