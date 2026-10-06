import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Download,
  Printer,
  History,
  CheckCircle2,
  XCircle,
  X,
  Truck,
  TrendingUp,
  Clock,
  Layers,
  Coins,
  PieChart,
  Edit3,
  Calendar,
  Building2,
  Save,
  Trash2,
  MoreVertical,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { exportToCSV } from '../../../utils/exportUtils';
import api from '../../../services/api';
import AdminInventoryReceivingView from './AdminInventoryReceivingView';
import AdminRecipeBuilderView from './AdminRecipeBuilderView';
import AdminCostsMarginsView from './AdminCostsMarginsView';
import AdminExpiryTrackingView from './AdminExpiryTrackingView';
import AdminSuppliersView from './AdminSuppliersView';
import AdminActivityLogsView from './AdminActivityLogsView';

// Preset catalog of 200+ standard restaurant/canteen ingredients with Urdu aliases
const INGREDIENT_PRESETS = [
  // Meat & Protein
  { label: '🍗 Chicken Breast', name: 'Chicken Breast', unit: 'KG', category: 'Meat & Protein', aliases: ['chicken', 'murghi', 'chiken', 'breast'] },
  { label: '🍗 Chicken Boneless', name: 'Chicken Boneless', unit: 'KG', category: 'Meat & Protein', aliases: ['chicken', 'boneless', 'murghi'] },
  { label: '🍗 Chicken Mince (Keema)', name: 'Chicken Mince', unit: 'KG', category: 'Meat & Protein', aliases: ['chicken keema', 'qima', 'qeema'] },
  { label: '🍗 Whole Chicken', name: 'Whole Chicken', unit: 'KG', category: 'Meat & Protein', aliases: ['chicken', 'poora murgh'] },
  { label: '🍗 Chicken Wings', name: 'Chicken Wings', unit: 'KG', category: 'Meat & Protein', aliases: ['wings', 'chicken'] },
  { label: '🍗 Chicken Thighs', name: 'Chicken Thighs', unit: 'KG', category: 'Meat & Protein', aliases: ['thigh', 'chicken'] },
  { label: '🥩 Beef Mince (Keema)', name: 'Beef Mince', unit: 'KG', category: 'Meat & Protein', aliases: ['beef keema', 'bada keema', 'qima', 'qeema'] },
  { label: '🥩 Beef Boneless', name: 'Beef Boneless', unit: 'KG', category: 'Meat & Protein', aliases: ['beef', 'bada gosht'] },
  { label: '🥩 Beef Boti / Stew Meat', name: 'Beef Boti', unit: 'KG', category: 'Meat & Protein', aliases: ['beef boti', 'pasanday'] },
  { label: '🥩 Mutton / Lamb Meat', name: 'Mutton Meat', unit: 'KG', category: 'Meat & Protein', aliases: ['mutton', 'bakra', 'gosht', 'lamb'] },
  { label: '🥩 Mutton Mince', name: 'Mutton Mince', unit: 'KG', category: 'Meat & Protein', aliases: ['mutton keema', 'bakra keema'] },
  { label: '🐟 Fish Fillet', name: 'Fish Fillet', unit: 'KG', category: 'Meat & Protein', aliases: ['machli', 'fish', 'surmai', 'rahu'] },
  { label: '🦐 Prawns / Shrimp', name: 'Prawns', unit: 'KG', category: 'Meat & Protein', aliases: ['jhinga', 'prawn', 'shrimp'] },
  { label: '🥚 Fresh Eggs', name: 'Eggs', unit: 'DOZEN', category: 'Meat & Protein', aliases: ['anda', 'anday', 'egg'] },
  { label: '🥓 Seekh Kebab Mix', name: 'Seekh Kebab Meat', unit: 'KG', category: 'Meat & Protein', aliases: ['kebab', 'kabab'] },
  { label: '🥩 Beef Burger Patties', name: 'Beef Burger Patties', unit: 'PCS', category: 'Meat & Protein', aliases: ['patty', 'burger patty'] },
  { label: '🍗 Chicken Burger Patties', name: 'Chicken Patties', unit: 'PCS', category: 'Meat & Protein', aliases: ['chicken patty'] },

  // Vegetables
  { label: '🥔 Aloo (Potatoes)', name: 'Potatoes', unit: 'KG', category: 'Vegetables', aliases: ['aloo', 'patato', 'potatos'] },
  { label: '🧅 Pyaz (Onions)', name: 'Onions', unit: 'KG', category: 'Vegetables', aliases: ['pyaz', 'pyaaz', 'onion'] },
  { label: '🍅 Tamatar (Tomatoes)', name: 'Tomatoes', unit: 'KG', category: 'Vegetables', aliases: ['tamatar', 'tomato', 'tamatar'] },
  { label: '🧄 Lehsan (Garlic)', name: 'Garlic', unit: 'KG', category: 'Vegetables', aliases: ['lehsan', 'lahsan', 'garlic'] },
  { label: '🫚 Adrak (Ginger)', name: 'Ginger', unit: 'KG', category: 'Vegetables', aliases: ['adrak', 'ginger'] },
  { label: '🌶 Hari Mirch (Green Chillies)', name: 'Green Chillies', unit: 'KG', category: 'Vegetables', aliases: ['hari mirch', 'green chilli', 'mirch'] },
  { label: '🍋 Leemon (Lemons)', name: 'Lemons', unit: 'KG', category: 'Vegetables', aliases: ['lemon', 'limbu', 'leemun'] },
  { label: '🌿 Hara Dhania (Coriander Leaves)', name: 'Coriander Leaves', unit: 'KG', category: 'Vegetables', aliases: ['dhania', 'coriander', 'hara dhaniya'] },
  { label: '🌿 Podina (Mint Leaves)', name: 'Mint Leaves', unit: 'KG', category: 'Vegetables', aliases: ['pudina', 'podina', 'mint'] },
  { label: '🫑 Shimla Mirch (Capsicum)', name: 'Capsicum', unit: 'KG', category: 'Vegetables', aliases: ['shimla mirch', 'bell pepper', 'capsicum'] },
  { label: '🥕 Gajar (Carrots)', name: 'Carrots', unit: 'KG', category: 'Vegetables', aliases: ['gajar', 'carrot'] },
  { label: '🥒 Kheera (Cucumber)', name: 'Cucumber', unit: 'KG', category: 'Vegetables', aliases: ['kheera', 'cucumber'] },
  { label: '🥬 Band Gobhi (Cabbage)', name: 'Cabbage', unit: 'KG', category: 'Vegetables', aliases: ['cabbage', 'gobhi', 'patta gobhi'] },
  { label: '🥦 Phool Gobhi (Cauliflower)', name: 'Cauliflower', unit: 'KG', category: 'Vegetables', aliases: ['cauliflower', 'cauli'] },
  { label: '🍆 Baingan (Eggplant / Brinjal)', name: 'Eggplant', unit: 'KG', category: 'Vegetables', aliases: ['baingan', 'brinjal'] },
  { label: '🫛 Matar (Green Peas)', name: 'Green Peas', unit: 'KG', category: 'Vegetables', aliases: ['matar', 'peas'] },
  { label: '🫛 Bhindi (Ladyfinger / Okra)', name: 'Lady Finger', unit: 'KG', category: 'Vegetables', aliases: ['bhindi', 'okra'] },
  { label: '🍄 Mushrooms', name: 'Mushrooms', unit: 'KG', category: 'Vegetables', aliases: ['khumbi', 'mushroom'] },
  { label: '🌱 Palak (Spinach)', name: 'Spinach', unit: 'KG', category: 'Vegetables', aliases: ['palak', 'spinach'] },
  { label: '🫛 Lobia / Beans', name: 'Green Beans', unit: 'KG', category: 'Vegetables', aliases: ['phalia', 'lobia'] },

  // Dry Goods & Grains
  { label: '🍚 Basmati Rice', name: 'Basmati Rice', unit: 'KG', category: 'Dry Goods', aliases: ['rice', 'chawal', 'basmati'] },
  { label: '🍚 Sella Rice (Biryani)', name: 'Sella Rice', unit: 'KG', category: 'Dry Goods', aliases: ['sella', 'chawal', 'biryani rice'] },
  { label: '🌾 Aata (Wheat Flour)', name: 'Wheat Flour', unit: 'KG', category: 'Dry Goods', aliases: ['aata', 'flour', 'gundum'] },
  { label: '🫙 Maida (Refined Flour)', name: 'Maida', unit: 'KG', category: 'Dry Goods', aliases: ['maida', 'refined flour'] },
  { label: '🫙 Suji (Semolina)', name: 'Suji', unit: 'KG', category: 'Dry Goods', aliases: ['suji', 'semolina'] },
  { label: '🫓 Besan (Gram Flour)', name: 'Besan', unit: 'KG', category: 'Dry Goods', aliases: ['besan', 'chana flour'] },
  { label: '🫘 Chana Dal', name: 'Chana Dal', unit: 'KG', category: 'Dry Goods', aliases: ['dal chana', 'chana dal'] },
  { label: '🫘 Moong Dal', name: 'Moong Dal', unit: 'KG', category: 'Dry Goods', aliases: ['dal moong'] },
  { label: '🫘 Masoor Dal', name: 'Masoor Dal', unit: 'KG', category: 'Dry Goods', aliases: ['dal masoor', 'kaali dal'] },
  { label: '🫘 Mash Dal', name: 'Mash Dal', unit: 'KG', category: 'Dry Goods', aliases: ['dal mash', 'white dal'] },
  { label: '🫘 Safaid Chana (Chickpeas)', name: 'White Chickpeas', unit: 'KG', category: 'Dry Goods', aliases: ['chana', 'chhole', 'kabuli chana'] },
  { label: '🫘 Kaala Chana', name: 'Black Chickpeas', unit: 'KG', category: 'Dry Goods', aliases: ['kaala chana'] },
  { label: '🫙 Cheeni (Sugar)', name: 'Sugar', unit: 'KG', category: 'Dry Goods', aliases: ['sugar', 'cheeni', 'shakar'] },
  { label: '🫙 Gur (Jaggery)', name: 'Jaggery', unit: 'KG', category: 'Dry Goods', aliases: ['gur', 'gud'] },
  { label: '🍜 Noodles / Pasta', name: 'Pasta Noodles', unit: 'KG', category: 'Dry Goods', aliases: ['noodles', 'pasta', 'macaroni', 'spaghetti'] },
  { label: '🍞 Bread Crumbs', name: 'Bread Crumbs', unit: 'KG', category: 'Dry Goods', aliases: ['breadcrumbs', 'crum'] },
  { label: '🌾 Cornflour', name: 'Cornflour', unit: 'KG', category: 'Dry Goods', aliases: ['corn starch', 'cornflour'] },

  // Dairy & Refrigerated
  { label: '🥛 Doodh (Fresh Milk)', name: 'Milk', unit: 'L', category: 'Dairy', aliases: ['doodh', 'milk', 'tetra pak'] },
  { label: '🥛 TetraPak Milk (Full Cream)', name: 'TetraPak Milk', unit: 'PACK', category: 'Dairy', aliases: ['olpers', 'nestle', 'milk pack'] },
  { label: '🧀 Mozzarella Cheese', name: 'Mozzarella Cheese', unit: 'KG', category: 'Dairy', aliases: ['cheese', 'pizza cheese'] },
  { label: '🧀 Cheddar Cheese Block', name: 'Cheddar Cheese', unit: 'KG', category: 'Dairy', aliases: ['cheddar', 'cheese'] },
  { label: '🧀 Cheese Slices', name: 'Cheese Slices', unit: 'PACK', category: 'Dairy', aliases: ['slice cheese', 'burger cheese'] },
  { label: '🧈 Makhan (Butter)', name: 'Butter', unit: 'KG', category: 'Dairy', aliases: ['makhan', 'butter', 'blue band'] },
  { label: '🍦 Fresh Cream (Malai)', name: 'Fresh Cream', unit: 'L', category: 'Dairy', aliases: ['cream', 'malai', 'milkpak cream'] },
  { label: '🥛 Dahi (Yogurt)', name: 'Yogurt', unit: 'KG', category: 'Dairy', aliases: ['dahi', 'yogurt', 'curd'] },
  { label: '🧈 Desi Ghee', name: 'Desi Ghee', unit: 'KG', category: 'Dairy', aliases: ['ghee', 'asli ghee', 'desi ghee'] },
  { label: '🧀 Paneer (Cottage Cheese)', name: 'Paneer', unit: 'KG', category: 'Dairy', aliases: ['paneer', 'cottage cheese'] },
  { label: '🥛 Condensed Milk', name: 'Condensed Milk', unit: 'PACK', category: 'Dairy', aliases: ['condensed milk', 'can milk'] },

  // Cooking Oil & Fats
  { label: '🛢️ Cooking Oil (Ghee/Oil)', name: 'Cooking Oil', unit: 'L', category: 'Sauces & Condiments', aliases: ['oil', 'tel', 'pakwan oil', 'dalda'] },
  { label: '🛢️ Banaspati Ghee', name: 'Banaspati Ghee', unit: 'KG', category: 'Sauces & Condiments', aliases: ['ghee', 'dalda ghee'] },
  { label: '🛢️ Mustard Oil (Sarson)', name: 'Mustard Oil', unit: 'L', category: 'Sauces & Condiments', aliases: ['sarson ka tel', 'mustard oil'] },
  { label: '🫒 Olive Oil', name: 'Olive Oil', unit: 'L', category: 'Sauces & Condiments', aliases: ['zaitoon', 'olive oil'] },

  // Sauces & Condiments
  { label: '🧃 Tomato Ketchup', name: 'Tomato Ketchup', unit: 'KG', category: 'Sauces & Condiments', aliases: ['ketchup', 'tomato sauce', 'sauce'] },
  { label: '🧴 Mayonnaise', name: 'Mayonnaise', unit: 'KG', category: 'Sauces & Condiments', aliases: ['mayo', 'mayonnaise', 'garlic mayo'] },
  { label: '🌶 Chilli Garlic Sauce', name: 'Chilli Garlic Sauce', unit: 'KG', category: 'Sauces & Condiments', aliases: ['chilli sauce', 'sauce'] },
  { label: '🧴 Soy Sauce', name: 'Soy Sauce', unit: 'L', category: 'Sauces & Condiments', aliases: ['soya sauce', 'soy'] },
  { label: '🧴 Vinegar (Sirka)', name: 'Vinegar', unit: 'L', category: 'Sauces & Condiments', aliases: ['sirka', 'vinegar'] },
  { label: '🌶 Hot Sauce / Sriracha', name: 'Hot Sauce', unit: 'L', category: 'Sauces & Condiments', aliases: ['hot sauce', 'sriracha'] },
  { label: '🍯 Mustard Sauce / Paste', name: 'Mustard Paste', unit: 'KG', category: 'Sauces & Condiments', aliases: ['mustard', 'rai'] },
  { label: '🧴 BBQ Sauce', name: 'BBQ Sauce', unit: 'KG', category: 'Sauces & Condiments', aliases: ['barbecue sauce', 'bbq'] },
  { label: '🍕 Pizza Sauce', name: 'Pizza Sauce', unit: 'KG', category: 'Sauces & Condiments', aliases: ['pizza sauce', 'marinara'] },
  { label: '🫙 Imli Chutney (Tamarind)', name: 'Imli Chutney', unit: 'KG', category: 'Sauces & Condiments', aliases: ['imli', 'tamarind chutney'] },

  // Spices & Masalas
  { label: '🧂 Namak (Salt)', name: 'Salt', unit: 'KG', category: 'Spices', aliases: ['namak', 'salt'] },
  { label: '🌶 Lal Mirch Powder', name: 'Red Chilli Powder', unit: 'KG', category: 'Spices', aliases: ['lal mirch', 'red chilli'] },
  { label: '🌶 Lal Mirch Flakes (Kuti)', name: 'Red Chilli Flakes', unit: 'KG', category: 'Spices', aliases: ['kuti mirch', 'chilli flakes'] },
  { label: '🟡 Haldi Powder (Turmeric)', name: 'Turmeric Powder', unit: 'KG', category: 'Spices', aliases: ['haldi', 'turmeric'] },
  { label: '🫙 Garam Masala Powder', name: 'Garam Masala', unit: 'KG', category: 'Spices', aliases: ['garam masala', 'pisa masala'] },
  { label: '🫘 Zeera (Cumin Seeds)', name: 'Cumin Seeds', unit: 'KG', category: 'Spices', aliases: ['zeera', 'zira', 'cumin'] },
  { label: '🫘 Sabut Dhania (Coriander)', name: 'Coriander Seeds', unit: 'KG', category: 'Spices', aliases: ['sabut dhania', 'coriander seeds'] },
  { label: '⚫ Kaali Mirch (Black Pepper)', name: 'Black Pepper Powder', unit: 'KG', category: 'Spices', aliases: ['kaali mirch', 'black pepper'] },
  { label: '🫙 Biryani Masala Box', name: 'Biryani Masala', unit: 'PACK', category: 'Spices', aliases: ['biryani masala', 'shan biryani'] },
  { label: '🫙 Karahi Masala Box', name: 'Karahi Masala', unit: 'PACK', category: 'Spices', aliases: ['karahi masala', 'shan karahi'] },
  { label: '🫙 Tikka Masala Box', name: 'Tikka Masala', unit: 'PACK', category: 'Spices', aliases: ['tikka masala'] },
  { label: '🫙 Chaat Masala', name: 'Chaat Masala', unit: 'KG', category: 'Spices', aliases: ['chaat masala'] },
  { label: '🫙 Kasuri Methi', name: 'Kasuri Methi', unit: 'KG', category: 'Spices', aliases: ['methi', 'kasuri methi'] },
  { label: '🫙 Cinnamon Stick (Darchini)', name: 'Cinnamon Sticks', unit: 'KG', category: 'Spices', aliases: ['darchini', 'cinnamon'] },
  { label: '🫙 Elaichi (Green Cardamom)', name: 'Green Cardamom', unit: 'KG', category: 'Spices', aliases: ['elaichi', 'chhoti elaichi', 'cardamom'] },
  { label: '🫙 Badi Elaichi (Black Cardamom)', name: 'Black Cardamom', unit: 'KG', category: 'Spices', aliases: ['badi elaichi'] },
  { label: '🫙 Laung (Cloves)', name: 'Cloves', unit: 'KG', category: 'Spices', aliases: ['laung', 'cloves'] },
  { label: '🫙 Tez Patta (Bay Leaves)', name: 'Bay Leaves', unit: 'KG', category: 'Spices', aliases: ['tez patta', 'bay leaf'] },

  // Bakery & Bread
  { label: '🍞 Burger Buns (Regular)', name: 'Burger Buns', unit: 'PCS', category: 'Bakery', aliases: ['bun', 'burger bun'] },
  { label: '🍞 Burger Buns (Sesame)', name: 'Sesame Burger Buns', unit: 'PCS', category: 'Bakery', aliases: ['sesame bun', 'bun'] },
  { label: '🍞 Sandwich Bread (Large)', name: 'Sandwich Bread', unit: 'PACK', category: 'Bakery', aliases: ['bread', 'double roti'] },
  { label: '🫓 Shawarma Pita Bread', name: 'Pita Bread', unit: 'PCS', category: 'Bakery', aliases: ['shawarma bread', 'pita'] },
  { label: '🫓 Naan Bread (Plain)', name: 'Naan', unit: 'PCS', category: 'Bakery', aliases: ['naan', 'roti'] },
  { label: '🫓 Paratha (Frozen/Fresh)', name: 'Paratha', unit: 'PCS', category: 'Bakery', aliases: ['paratha', 'roll paratha'] },
  { label: '🍕 Pizza Crust / Base (Medium)', name: 'Pizza Dough Base', unit: 'PCS', category: 'Bakery', aliases: ['pizza base', 'dough'] },
  { label: '🥐 Croissants', name: 'Croissants', unit: 'PCS', category: 'Bakery', aliases: ['croissant'] },

  // Beverages & Chai
  { label: '☕ Chai Patti (Everyday/Supreme)', name: 'Tea Leaves', unit: 'KG', category: 'Beverages', aliases: ['chai patti', 'tea', 'tapal', 'lipton'] },
  { label: '☕ Coffee Powder (Instant)', name: 'Coffee Powder', unit: 'KG', category: 'Beverages', aliases: ['coffee', 'nescafe'] },
  { label: '☕ Coffee Beans (Espresso)', name: 'Coffee Beans', unit: 'KG', category: 'Beverages', aliases: ['coffee beans', 'espresso'] },
  { label: '🥤 Cold Drink Cans (Assorted)', name: 'Cold Drinks 250ml', unit: 'PCS', category: 'Beverages', aliases: ['pepsi', 'coke', '7up', 'sprite', 'cold drink'] },
  { label: '🥤 Cold Drink 1.5L Bottles', name: 'Cold Drinks 1.5L', unit: 'BOTTLE', category: 'Beverages', aliases: ['bottle', 'cold drink bottle'] },
  { label: '💧 Mineral Water Bottles (500ml)', name: 'Water Bottles 500ml', unit: 'PCS', category: 'Beverages', aliases: ['water', 'paani', 'nestle pure life'] },
  { label: '💧 Mineral Water Can (19L)', name: 'Water Can 19L', unit: 'BOTTLE', category: 'Beverages', aliases: ['water 19l', 'chiller water'] },
  { label: '🧃 Fruit Juices (Pack)', name: 'Fruit Juices', unit: 'PACK', category: 'Beverages', aliases: ['juice', 'nestle juice', 'shezan'] },
  { label: '🍧 Rooh Afza / Jam-e-Shirin', name: 'Rooh Afza Syrup', unit: 'BOTTLE', category: 'Beverages', aliases: ['rooh afza', 'jam e shirin', 'red syrup'] },
  { label: '🍋 Lemonade Concentrate', name: 'Lemon Syrup', unit: 'BOTTLE', category: 'Beverages', aliases: ['lemonade', 'limca'] },

  // Packaging & Disposables
  { label: '📦 Burger Box (Paperboard)', name: 'Burger Boxes', unit: 'PCS', category: 'Packaging', aliases: ['burger box', 'packaging'] },
  { label: '📦 Pizza Boxes (12 inch)', name: 'Pizza Boxes 12 inch', unit: 'PCS', category: 'Packaging', aliases: ['pizza box', 'box'] },
  { label: '🥤 Hot Drink Cups 8oz (Paper)', name: 'Paper Tea Cups 8oz', unit: 'PCS', category: 'Packaging', aliases: ['chai cup', 'paper cup'] },
  { label: '🥤 Cold Drink Cups & Lids 16oz', name: 'Beverage Cups 16oz', unit: 'PCS', category: 'Packaging', aliases: ['cold cup', 'plastic cup'] },
  { label: '🥡 Takeaway Food Containers (Plastic)', name: 'Food Containers 750ml', unit: 'PCS', category: 'Packaging', aliases: ['dabba', 'container', 'packing box'] },
  { label: '🛍️ Shopping Bags (Biodegradable)', name: 'Shopper Bags', unit: 'KG', category: 'Packaging', aliases: ['shopper', 'polythene', 'bag'] },
  { label: '🧻 Tissue Paper Napkins', name: 'Tissue Napkins', unit: 'PACK', category: 'Packaging', aliases: ['tissue', 'tissue paper'] },
  { label: '🥖 Butter Paper Roll / Sheets', name: 'Butter Paper', unit: 'PACK', category: 'Packaging', aliases: ['butter paper', 'wrap paper'] },
  { label: '🍙 Aluminum Foil Roll', name: 'Aluminum Foil', unit: 'ROLL', category: 'Packaging', aliases: ['foil paper', 'silver foil'] },
  { label: '🥤 Drinking Straws (Paper/Plastic)', name: 'Straws', unit: 'PACK', category: 'Packaging', aliases: ['straw', 'straws'] },

  // Kitchen Supplies & Cleaning
  { label: '🧼 Dishwashing Liquid (Vim/Lemon)', name: 'Dishwash Soap', unit: 'L', category: 'Kitchen Supplies', aliases: ['vim', 'sabun', 'dishwash'] },
  { label: '🧽 Sponge Scrubber Pads', name: 'Scrubber Sponge', unit: 'PCS', category: 'Kitchen Supplies', aliases: ['sponge', 'scrubber', 'khurchan'] },
  { label: '🧤 Disposable Plastic Gloves', name: 'Kitchen Gloves', unit: 'BOX', category: 'Kitchen Supplies', aliases: ['gloves', 'dastanay'] },
  { label: '🧹 Mop / Cleaning Cloth', name: 'Cleaning Cloth', unit: 'PCS', category: 'Kitchen Supplies', aliases: ['poocha', 'cloth', 'duster'] },

  // Desserts & Sweets
  { label: '🍫 Chocolate Syrup (Hershey)', name: 'Chocolate Syrup', unit: 'BOTTLE', category: 'Desserts', aliases: ['chocolate sauce', 'syrup'] },
  { label: '🍨 Vanilla Ice Cream Tub (2L)', name: 'Vanilla Ice Cream', unit: 'BOX', category: 'Desserts', aliases: ['icecream', 'ice cream'] },
  { label: '🍫 Cocoa Powder', name: 'Cocoa Powder', unit: 'KG', category: 'Desserts', aliases: ['cocoa', 'coco powder'] },
  { label: '🧁 Chocolate Chips', name: 'Chocolate Chips', unit: 'KG', category: 'Desserts', aliases: ['choco chips'] },
  { label: '🍓 Strawberry Jam / Topping', name: 'Strawberry Jam', unit: 'KG', category: 'Desserts', aliases: ['jam', 'strawberry'] }
];

const QUICK_PICK_GROUPS = [
  { label: 'Meat & Protein', icon: '🍗', category: 'Meat & Protein' },
  { label: 'Vegetables & Herbs', icon: '🥬', category: 'Vegetables' },
  { label: 'Dry Goods & Rice', icon: '🌾', category: 'Dry Goods' },
  { label: 'Dairy & Cheese', icon: '🧀', category: 'Dairy' },
  { label: 'Sauces & Condiments', icon: '🛢️', category: 'Sauces & Condiments' },
  { label: 'Spices & Masala', icon: '🌶', category: 'Spices' },
  { label: 'Bakery & Bread', icon: '🍞', category: 'Bakery' },
  { label: 'Beverages & Tea', icon: '☕', category: 'Beverages' },
  { label: 'Packaging & Disposable', icon: '📦', category: 'Packaging' },
  { label: 'Kitchen & Cleaning', icon: '🧼', category: 'Kitchen Supplies' },
  { label: 'Desserts & Sweets', icon: '🍫', category: 'Desserts' },
];

// Quantity Formatter helper (no unnecessary trailing decimals, e.g. 164.4 KG or 300 PCS)
const formatQuantity = (qty, unit) => {
  const num = parseFloat(qty) || 0;
  if (unit === 'PCS' || unit === 'DOZEN' || unit === 'BOX' || unit === 'PACK' || unit === 'BOTTLE') {
    return Math.round(num).toLocaleString();
  }
  return (Math.round(num * 100) / 100).toLocaleString();
};

const AdminInventoryView = ({ inventory = [], logs = [], onRefresh, showToast }) => {
  const [activeTab, setActiveTab] = useState('CATALOG');
  const [summary, setSummary] = useState(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | LOW | NORMAL | OVERSTOCK
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NAME_ASC'); // NAME_ASC | NAME_DESC | LOW_STOCK_FIRST | OVERSTOCK_FIRST | STOCK_LOW_TO_HIGH | STOCK_HIGH_TO_LOW | COST_HIGH_TO_LOW | RECENTLY_UPDATED
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Quick Action Modal State
  const [selectedItemForDetails, setSelectedItemForDetails] = useState(null);
  const [selectedItemForAdjustment, setSelectedItemForAdjustment] = useState(null);
  const [itemActionMenuId, setItemActionMenuId] = useState(null);
  
  // Stock Adjustment Form State
  const [adjType, setAdjType] = useState('CORRECTION'); // CORRECTION | WASTE | EXPIRATION | DAMAGE | USED | OTHER
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Modal / Recipe / Supplier state
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [menuItemsList, setMenuItemsList] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [marginsList, setMarginsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [expiringList, setExpiringList] = useState([]);
  const [receivingsList, setReceivingsList] = useState([]);
  
  // Add New Item Modal State
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [quickPickSearch, setQuickPickSearch] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [newItem, setNewItem] = useState({
    name: '',
    unit: 'KG',
    category: 'General',
    minThreshold: '10',
    maxThreshold: '100',
    costPrice: '0',
    stockLevel: '0',
    supplierId: '',
    expiryDate: '',
    notes: '',
  });

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });

  const fetchSummary = async () => {
    try {
      const res = await api.get('/inventory/summary');
      if (res.data) setSummary(res.data);
    } catch (err) {
      console.warn('Fetch summary error:', err.message);
    }
  };

  const fetchMargins = async () => {
    try {
      const res = await api.get('/inventory/recipes/margins');
      if (res.data?.margins) setMarginsList(res.data.margins);
    } catch (err) {
      console.warn('Fetch margins error:', err.message);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/inventory/suppliers');
      if (res.data?.suppliers) setSuppliersList(res.data.suppliers);
    } catch (err) {
      console.warn('Fetch suppliers error:', err.message);
    }
  };

  const fetchExpiring = async () => {
    try {
      const res = await api.get('/inventory/expiring');
      if (res.data?.items) setExpiringList(res.data.items);
    } catch (err) {
      console.warn('Fetch expiring error:', err.message);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const res = await api.get('/menu?all=true');
      if (res.data?.items) setMenuItemsList(res.data.items);
    } catch (err) {
      console.warn('Fetch menu items error:', err.message);
    }
  };

  const fetchReceivings = async () => {
    try {
      const res = await api.get('/inventory/receivings');
      if (res.data?.receivings) setReceivingsList(res.data.receivings);
    } catch (err) {
      console.warn('Fetch receivings error:', err.message);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchSuppliers();
    fetchReceivings();
    if (activeTab === 'MARGINS' || activeTab === 'RECIPES') fetchMargins();
    if (activeTab === 'EXPIRY') fetchExpiring();
    if (activeTab === 'RECIPES') fetchMenuItems();
  }, [activeTab]);

  // Compute status & stats for all items in inventory
  const stockList = useMemo(() => {
    return inventory.map((item) => {
      const stock = parseFloat(item.stockLevel) || 0;
      const min = parseFloat(item.minThreshold) || 10;
      
      let status = 'NORMAL';
      if (stock <= min) {
        status = 'LOW';
      } else if (stock >= min * 3) {
        status = 'OVERSTOCK';
      }

      return { ...item, status };
    });
  }, [inventory]);

  // Status Summary Counts
  const statusCounts = useMemo(() => {
    let total = stockList.length;
    let low = 0;
    let normal = 0;
    let overstock = 0;

    for (const item of stockList) {
      if (item.status === 'LOW') low++;
      else if (item.status === 'OVERSTOCK') overstock++;
      else normal++;
    }

    return { total, low, normal, overstock };
  }, [stockList]);

  // Filtered & Sorted Stock List
  const filteredAndSortedStock = useMemo(() => {
    let result = stockList.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(q);
      const catMatch = (item.category || '').toLowerCase().includes(q);
      const supMatch = (item.supplier?.name || '').toLowerCase().includes(q);
      const unitMatch = (item.unit || '').toLowerCase().includes(q);

      const matchesSearch = !q || nameMatch || catMatch || supMatch || unitMatch;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchesSupplier = supplierFilter === 'ALL' || String(item.supplierId) === String(supplierFilter);
      const matchesUnit = unitFilter === 'ALL' || item.unit === unitFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesSupplier && matchesUnit;
    });

    // Apply Sorting
    result.sort((a, b) => {
      if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
      if (sortBy === 'NAME_DESC') return b.name.localeCompare(a.name);
      if (sortBy === 'LOW_STOCK_FIRST') {
        const order = { LOW: 1, NORMAL: 2, OVERSTOCK: 3 };
        return (order[a.status] || 2) - (order[b.status] || 2);
      }
      if (sortBy === 'OVERSTOCK_FIRST') {
        const order = { OVERSTOCK: 1, NORMAL: 2, LOW: 3 };
        return (order[a.status] || 2) - (order[b.status] || 2);
      }
      if (sortBy === 'STOCK_LOW_TO_HIGH') return a.stockLevel - b.stockLevel;
      if (sortBy === 'STOCK_HIGH_TO_LOW') return b.stockLevel - a.stockLevel;
      if (sortBy === 'COST_HIGH_TO_LOW') return (b.costPrice || 0) - (a.costPrice || 0);
      if (sortBy === 'RECENTLY_UPDATED') return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      return 0;
    });

    return result;
  }, [stockList, searchTerm, statusFilter, categoryFilter, supplierFilter, unitFilter, sortBy]);

  // Paginated Catalog Items
  const paginatedStock = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedStock.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedStock, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedStock.length / itemsPerPage) || 1;

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setSupplierFilter('ALL');
    setUnitFilter('ALL');
    setSortBy('NAME_ASC');
    setCurrentPage(1);
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newItem,
        expiryDate: newItem.expiryDate ? newItem.expiryDate : null,
        notes: newItem.notes || null,
        supplierId: newItem.supplierId ? parseInt(newItem.supplierId, 10) : null
      };
      await api.post('/inventory', payload);
      if (showToast) showToast(`Added inventory item ${newItem.name}!`);
      setShowAddItemModal(false);
      setIngredientSearch('');
      setShowSuggestions(false);
      setNewItem({
        name: '',
        unit: 'KG',
        category: 'General',
        minThreshold: '10',
        maxThreshold: '100',
        costPrice: '0',
        stockLevel: '0',
        supplierId: '',
        expiryDate: '',
        notes: '',
      });
      if (onRefresh) onRefresh();
      fetchSummary();
      fetchReceivings();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to add item', 'error');
    }
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForAdjustment || !adjQty) return;

    try {
      const isDecrease = ['WASTE', 'EXPIRATION', 'DAMAGE', 'USED'].includes(adjType);
      const qtyChange = isDecrease ? -Math.abs(parseFloat(adjQty)) : parseFloat(adjQty);

      await api.post('/inventory/adjust', {
        inventoryItemId: selectedItemForAdjustment.id,
        type: adjType,
        changeQty: qtyChange,
        reason: adjReason || `Stock ${adjType}`,
      });

      if (showToast) showToast(`Stock adjustment (${adjType}) recorded successfully!`);
      setSelectedItemForAdjustment(null);
      setAdjQty('');
      setAdjReason('');
      if (onRefresh) onRefresh();
      fetchSummary();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Adjustment failed', 'error');
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}" from catalog?`)) return;
    try {
      await api.delete(`/inventory/${itemId}`);
      if (showToast) showToast(`Deleted "${itemName}" from catalog.`);
      if (onRefresh) onRefresh();
      fetchSummary();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to delete item', 'error');
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredAndSortedStock.map((item) => ({
      ItemName: item.name,
      Category: item.category || 'General',
      CurrentStock: item.stockLevel,
      MinimumStock: item.minThreshold,
      Unit: item.unit,
      CostPerUnit: item.costPrice || 0,
      Supplier: item.supplier?.name || 'N/A',
      Status: item.status,
    }));

    exportToCSV(`inventory_catalog_${Date.now()}.csv`, csvData, [
      { key: 'ItemName', label: 'Item Name' },
      { key: 'Category', label: 'Category' },
      { key: 'CurrentStock', label: 'Current Stock' },
      { key: 'MinimumStock', label: 'Minimum Stock' },
      { key: 'Unit', label: 'Unit' },
      { key: 'CostPerUnit', label: 'Cost per Unit' },
      { key: 'Supplier', label: 'Supplier' },
      { key: 'Status', label: 'Status' },
    ]);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)] border border-[var(--border-color)] p-5 sm:p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl font-black text-[var(--text-main)] font-display flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-orange-500/10 text-orange-400">📦</span>
            Inventory
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            View and manage all ingredients, supplies, and packaging.
          </p>
        </div>

        {/* Action Buttons: + Add Item, Receive Stock, Import Excel */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddItemModal(true)}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>

          <button
            onClick={() => setActiveTab('STOCK_IN')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Receive Stock</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--text-main)] rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Clickable Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Total Items */}
        <button
          type="button"
          onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 shadow-sm ${
            statusFilter === 'ALL'
              ? 'bg-orange-500/10 border-orange-500 text-orange-400 ring-2 ring-orange-500/20'
              : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-orange-500/40'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] block">
            Total Items
          </span>
          <div className="flex items-baseline justify-between">
            <h4 className="text-2xl font-black font-mono text-[var(--text-main)]">
              {statusCounts.total}
            </h4>
            <span className="text-[10px] text-[var(--text-muted)] font-bold">Items</span>
          </div>
        </button>

        {/* Card 2: Low Stock (Clickable) */}
        <button
          type="button"
          onClick={() => { setStatusFilter('LOW'); setCurrentPage(1); }}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 shadow-sm ${
            statusFilter === 'LOW'
              ? 'bg-rose-500/10 border-rose-500 text-rose-400 ring-2 ring-rose-500/20'
              : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-rose-500/40'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block">
            Low Stock
          </span>
          <div className="flex items-baseline justify-between">
            <h4 className="text-2xl font-black font-mono text-rose-400">
              {statusCounts.low}
            </h4>
            <span className="text-[10px] text-rose-400/80 font-bold">Needs Attention</span>
          </div>
        </button>

        {/* Card 3: Normal (Clickable) */}
        <button
          type="button"
          onClick={() => { setStatusFilter('NORMAL'); setCurrentPage(1); }}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 shadow-sm ${
            statusFilter === 'NORMAL'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-emerald-500/40'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
            Normal
          </span>
          <div className="flex items-baseline justify-between">
            <h4 className="text-2xl font-black font-mono text-emerald-400">
              {statusCounts.normal}
            </h4>
            <span className="text-[10px] text-emerald-400/80 font-bold">Healthy Stock</span>
          </div>
        </button>

        {/* Card 4: Overstock (Clickable) */}
        <button
          type="button"
          onClick={() => { setStatusFilter('OVERSTOCK'); setCurrentPage(1); }}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 shadow-sm ${
            statusFilter === 'OVERSTOCK'
              ? 'bg-blue-500/10 border-blue-500 text-blue-400 ring-2 ring-blue-500/20'
              : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-blue-500/40'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
            Overstock
          </span>
          <div className="flex items-baseline justify-between">
            <h4 className="text-2xl font-black font-mono text-blue-400">
              {statusCounts.overstock}
            </h4>
            <span className="text-[10px] text-blue-400/80 font-bold">Above Normal</span>
          </div>
        </button>

      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center p-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-x-auto gap-1">
        {[
          { id: 'CATALOG', label: 'Inventory Catalog', icon: Layers },
          { id: 'STOCK_IN', label: 'Receive Stock', icon: Truck },
          { id: 'RECIPES', label: 'Recipe Builder', icon: Edit3 },
          { id: 'MARGINS', label: 'Costs & Margins', icon: Coins },
          { id: 'EXPIRY', label: 'Expiry Tracking', icon: Clock },
          { id: 'SUPPLIERS', label: 'Suppliers', icon: Building2 },
          { id: 'LOGS', label: `Logs (${logs.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: INVENTORY CATALOG */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-5">
          
          {/* 3. Search & Filter Bar */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-4 sm:p-5 rounded-3xl space-y-3.5 shadow-sm">
            
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search items by name, category, supplier, unit..."
                className="w-full pl-10 pr-4 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 shadow-inner"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--text-muted)]" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              
              {/* Category Filter */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Meat & Protein">Meat & Protein</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Dry Goods">Dry Goods</option>
                  <option value="Spices">Spices</option>
                  <option value="Sauces & Condiments">Sauces & Condiments</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Cooking Oil">Cooking Oil</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Kitchen Supplies">Kitchen Supplies</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="LOW">Low Stock</option>
                  <option value="NORMAL">Normal</option>
                  <option value="OVERSTOCK">Overstock</option>
                </select>
              </div>

              {/* Supplier Filter */}
              <div>
                <select
                  value={supplierFilter}
                  onChange={(e) => { setSupplierFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] cursor-pointer"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliersList.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>

              {/* Unit Filter */}
              <div>
                <select
                  value={unitFilter}
                  onChange={(e) => { setUnitFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] cursor-pointer"
                >
                  <option value="ALL">All Units</option>
                  <option value="KG">KG</option>
                  <option value="G">G</option>
                  <option value="L">L</option>
                  <option value="ML">ML</option>
                  <option value="PCS">PCS</option>
                  <option value="PACK">PACK</option>
                  <option value="BOTTLE">BOTTLE</option>
                  <option value="BOX">BOX</option>
                  <option value="DOZEN">DOZEN</option>
                </select>
              </div>

              {/* Clear Filters */}
              <div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] hover:border-orange-500/50 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Sorting & Results Count Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-[var(--border-color)]/60 text-xs">
              <span className="text-[var(--text-muted)] font-medium">
                Showing <strong className="text-[var(--text-main)]">{filteredAndSortedStock.length}</strong> items
              </span>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider shrink-0">
                  Sort By:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] cursor-pointer"
                >
                  <option value="NAME_ASC">Item Name A–Z</option>
                  <option value="NAME_DESC">Item Name Z–A</option>
                  <option value="LOW_STOCK_FIRST">Low Stock First</option>
                  <option value="OVERSTOCK_FIRST">Overstock First</option>
                  <option value="STOCK_LOW_TO_HIGH">Lowest Stock</option>
                  <option value="STOCK_HIGH_TO_LOW">Highest Stock</option>
                  <option value="COST_HIGH_TO_LOW">Highest Cost</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table & Mobile Cards */}
          {filteredAndSortedStock.length === 0 ? (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-10 text-center space-y-3">
              <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
              <h3 className="text-sm font-black text-[var(--text-main)]">No items found</h3>
              <p className="text-xs text-[var(--text-muted)]">Try adjusting your search query or clear the filters to see all catalog items.</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Desktop Table View */}
              <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                        <th className="p-4">Item</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Stock Level</th>
                        <th className="p-4">Minimum</th>
                        <th className="p-4">Cost per Unit</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {paginatedStock.map((item) => {
                        const stockVal = parseFloat(item.stockLevel) || 0;
                        const minVal = parseFloat(item.minThreshold) || 10;
                        const percent = Math.min(100, Math.max(10, (stockVal / (minVal * 3)) * 100));

                        return (
                          <tr key={item.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                            
                            {/* Item Name & Subtitle */}
                            <td className="p-4">
                              <button
                                type="button"
                                onClick={() => setSelectedItemForDetails(item)}
                                className="text-left group cursor-pointer"
                              >
                                <span className="font-extrabold text-[var(--text-main)] group-hover:text-orange-400 text-xs block">
                                  {item.name}
                                </span>
                                {item.supplier?.name && (
                                  <span className="text-[10px] text-[var(--text-muted)] block">
                                    Supplier: {item.supplier.name}
                                  </span>
                                )}
                              </button>
                            </td>

                            {/* Category */}
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/20">
                                {item.category || 'General'}
                              </span>
                            </td>

                            {/* Stock Level with Progress Bar */}
                            <td className="p-4 min-w-[140px]">
                              <span className="font-mono font-black text-xs text-[var(--text-main)] block">
                                {formatQuantity(item.stockLevel, item.unit)} {item.unit}
                              </span>
                              
                              {/* Visual Stock Bar */}
                              <div className="w-28 h-1.5 bg-[var(--bg-color)] rounded-full overflow-hidden mt-1 border border-[var(--border-color)]">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    item.status === 'LOW'
                                      ? 'bg-rose-500'
                                      : item.status === 'OVERSTOCK'
                                      ? 'bg-blue-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </td>

                            {/* Minimum Stock */}
                            <td className="p-4 font-mono font-semibold text-[var(--text-muted)]">
                              {formatQuantity(item.minThreshold, item.unit)} {item.unit}
                            </td>

                            {/* Cost per Unit */}
                            <td className="p-4 font-mono font-black text-emerald-400">
                              {item.costPrice > 0 ? `Rs. ${item.costPrice} / ${item.unit}` : '—'}
                            </td>

                            {/* Status Badge */}
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border tracking-wider ${
                                item.status === 'LOW'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : item.status === 'OVERSTOCK'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {item.status === 'LOW' ? 'LOW STOCK' : item.status}
                              </span>
                            </td>

                            {/* Quick Action Buttons */}
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('STOCK_IN')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black transition-colors cursor-pointer border border-emerald-500/20"
                                >
                                  Receive
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedItemForAdjustment(item)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-black transition-colors cursor-pointer border border-amber-500/20"
                                >
                                  Adjust
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedItemForDetails(item)}
                                  className="p-1 rounded-lg bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile/Tablet Card Layout */}
              <div className="md:hidden grid grid-cols-1 gap-3">
                {paginatedStock.map((item) => {
                  const stockVal = parseFloat(item.stockLevel) || 0;
                  const minVal = parseFloat(item.minThreshold) || 10;
                  const percent = Math.min(100, Math.max(10, (stockVal / (minVal * 3)) * 100));

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] space-y-3 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-[var(--text-main)]">{item.name}</h4>
                          <span className="text-[10px] text-orange-400 font-bold uppercase">{item.category || 'General'}</span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                          item.status === 'LOW'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : item.status === 'OVERSTOCK'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--bg-color)]/60 p-2.5 rounded-xl border border-[var(--border-color)]">
                        <div>
                          <span className="text-[9px] text-[var(--text-muted)] uppercase block">Stock</span>
                          <span className="font-mono font-black text-orange-400">
                            {formatQuantity(item.stockLevel, item.unit)} {item.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--text-muted)] uppercase block">Cost</span>
                          <span className="font-mono font-black text-emerald-400">
                            Rs. {item.costPrice || 0} / {item.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">Min: {item.minThreshold} {item.unit}</span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab('STOCK_IN')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold"
                          >
                            Receive
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedItemForAdjustment(item)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold"
                          >
                            Adjust
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] text-xs">
                <span className="text-[var(--text-muted)]">
                  Showing <strong className="text-[var(--text-main)]">{(currentPage - 1) * itemsPerPage + 1}–{Math.min(filteredAndSortedStock.length, currentPage * itemsPerPage)}</strong> of <strong className="text-[var(--text-main)]">{filteredAndSortedStock.length}</strong> items
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 text-[var(--text-main)]" />
                  </button>

                  <span className="font-extrabold text-[var(--text-main)]">Page {currentPage} of {totalPages}</span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4 text-[var(--text-main)]" />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB 2: STOCK IN RECEIVING */}
      {activeTab === 'STOCK_IN' && (
        <AdminInventoryReceivingView
          inventory={inventory}
          suppliers={suppliersList}
          onRefresh={onRefresh}
          showToast={showToast}
        />
      )}

      {/* TAB 3: RECIPES */}
      {activeTab === 'RECIPES' && (
        <AdminRecipeBuilderView
          inventory={stockList}
          onRefresh={onRefresh}
          showToast={showToast}
          onOpenAddIngredientModal={() => setShowAddItemModal(true)}
        />
      )}

      {/* TAB 4: COSTS & MARGINS */}
      {activeTab === 'MARGINS' && (
        <AdminCostsMarginsView
          inventory={stockList}
          showToast={showToast}
          onNavigateToRecipes={() => setActiveTab('RECIPES')}
        />
      )}

      {/* TAB 5: EXPIRY TRACKING */}
      {activeTab === 'EXPIRY' && (
        <AdminExpiryTrackingView
          inventory={stockList}
          receivings={receivingsList}
          onOpenAdjustmentModal={(item) => setSelectedItemForAdjustment(item)}
          onRefresh={() => { fetchReceivings(); fetchStockItems(); fetchSummary(); if (onRefresh) onRefresh(); }}
          showToast={showToast}
        />
      )}

      {/* TAB 6: SUPPLIERS */}
      {activeTab === 'SUPPLIERS' && (
        <AdminSuppliersView
          suppliers={suppliersList}
          inventory={stockList}
          receivings={receivingsList}
          onRefresh={() => { fetchSuppliers(); fetchReceivings(); if (onRefresh) onRefresh(); }}
          showToast={showToast}
        />
      )}

      {/* TAB 7: ACTIVITY LOGS */}
      {activeTab === 'LOGS' && (
        <AdminActivityLogsView
          logs={logs}
          receivings={receivingsList}
        />
      )}

      {/* Quick Adjustment Modal */}
      {selectedItemForAdjustment && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Adjust Stock: {selectedItemForAdjustment.name}
              </h3>
              <button onClick={() => setSelectedItemForAdjustment(null)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="space-y-4 text-xs">
              <div className="bg-[var(--bg-color)] p-3 rounded-2xl border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block font-bold">Current Stock Level</span>
                <span className="text-base font-mono font-black text-orange-400">{selectedItemForAdjustment.stockLevel} {selectedItemForAdjustment.unit}</span>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">What happened? *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)]"
                >
                  <option value="CORRECTION">Audit Count Correction</option>
                  <option value="WASTE">Spoilage / Kitchen Waste (-)</option>
                  <option value="EXPIRATION">Expired Product (-)</option>
                  <option value="DAMAGE">Damaged Goods (-)</option>
                  <option value="USED">Unrecorded Usage (-)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">Quantity *</label>
                <input
                  type="number"
                  required
                  step="any"
                  min="0.01"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">Reason / Explanation *</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. 2 KG spoiled due to fridge issue"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setSelectedItemForAdjustment(null)} className="px-4 py-2 rounded-xl bg-[var(--bg-color)] font-bold text-[var(--text-muted)]">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-600 text-white font-black shadow-md">Save Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Details Modal */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-base font-black text-[var(--text-main)]">{selectedItemForDetails.name}</h3>
                <span className="text-[10px] text-orange-400 font-bold uppercase">{selectedItemForDetails.category || 'General'}</span>
              </div>
              <button onClick={() => setSelectedItemForDetails(null)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[var(--bg-color)] p-4 rounded-2xl text-xs font-semibold">
              <div>Current Stock: <strong className="text-orange-400 font-mono">{selectedItemForDetails.stockLevel} {selectedItemForDetails.unit}</strong></div>
              <div>Minimum Threshold: <strong className="text-[var(--text-muted)] font-mono">{selectedItemForDetails.minThreshold} {selectedItemForDetails.unit}</strong></div>
              <div>Cost per Unit: <strong className="text-emerald-400 font-mono">Rs. {selectedItemForDetails.costPrice || 0} / {selectedItemForDetails.unit}</strong></div>
              <div>Supplier: <strong className="text-[var(--text-main)]">{selectedItemForDetails.supplier?.name || '—'}</strong></div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => handleDeleteItem(selectedItemForDetails.id, selectedItemForDetails.name)} className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 font-bold text-xs">Delete Item</button>
              <button onClick={() => setSelectedItemForDetails(null)} className="px-4 py-2 rounded-xl bg-[var(--bg-color)] font-bold text-xs text-[var(--text-muted)]">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal — Portal to document.body for true screen centering */}
      {showAddItemModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-scale-up my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-[var(--text-main)] font-display flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-orange-500/10 text-orange-400">📦</span>
                  Add New Ingredient Item
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Pick from catalog presets below or type custom item details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddItemModal(false);
                  setIngredientSearch('');
                  setShowSuggestions(false);
                }}
                className="p-2 rounded-xl bg-[var(--bg-color)] hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer border border-[var(--border-color)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateItem} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              
              {/* Field 1: Ingredient Name with Live Autocomplete */}
              <div className="relative">
                <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px] flex justify-between">
                  <span>Ingredient Name *</span>
                  <span className="text-[10px] text-orange-400 font-normal lowercase">Type to search presets or enter custom</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newItem.name}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewItem({ ...newItem, name: val });
                      setIngredientSearch(val);
                      setShowSuggestions(true);

                      const matched = INGREDIENT_PRESETS.find(
                        p => p.name.toLowerCase().trim() === val.toLowerCase().trim()
                      );
                      if (matched) {
                        setNewItem(prev => ({
                          ...prev,
                          name: matched.name,
                          unit: matched.unit,
                          category: matched.category
                        }));
                      }
                    }}
                    placeholder="Search or type ingredient name (e.g. Chicken, Aloo, Oil)..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-bold tracking-wide"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {showSuggestions && ingredientSearch.trim().length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-[var(--border-color)]">
                    {(() => {
                      const query = ingredientSearch.toLowerCase().trim();
                      const matches = INGREDIENT_PRESETS.filter(p => 
                        p.name.toLowerCase().includes(query) ||
                        p.label.toLowerCase().includes(query) ||
                        p.category.toLowerCase().includes(query) ||
                        (p.aliases && p.aliases.some(a => a.toLowerCase().includes(query)))
                      );

                      if (matches.length === 0) {
                        return (
                          <div className="p-3 text-center text-[var(--text-muted)] text-[11px]">
                            No preset matching "<span className="text-[var(--text-main)] font-semibold">{ingredientSearch}</span>". Custom item will be created! ✨
                          </div>
                        );
                      }

                      return matches.slice(0, 10).map((item, idx) => {
                        const exists = inventory.some(i => i.name.toLowerCase().trim() === item.name.toLowerCase().trim());
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setNewItem({
                                ...newItem,
                                name: item.name,
                                unit: item.unit,
                                category: item.category
                              });
                              setIngredientSearch(item.name);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-orange-500/10 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">{item.label.split(' ')[0]}</span>
                              <div>
                                <span className="font-bold text-[var(--text-main)] group-hover:text-orange-400">{item.name}</span>
                                <span className="ml-2 text-[10px] text-[var(--text-muted)]">({item.category})</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[var(--bg-color)] text-orange-400 border border-orange-500/20">
                                {item.unit}
                              </span>
                              {exists && <span className="text-[10px] text-emerald-400 font-extrabold" title="Already in catalog">✓ In Stock</span>}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

                            {/* Quick Pick Presets Section — Categorized & Collapsible */}
              <div className="bg-[var(--bg-color)]/60 border border-[var(--border-color)] p-3 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">⚡</span>
                    <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">
                      Quick Pick Presets (Click to Auto-Fill):
                    </span>
                  </div>
                  <input
                    type="text"
                    value={quickPickSearch}
                    onChange={(e) => setQuickPickSearch(e.target.value)}
                    placeholder="Filter presets..."
                    className="px-2.5 py-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-[10px] text-[var(--text-main)] focus:outline-none focus:border-orange-500 w-32 font-medium"
                  />
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {QUICK_PICK_GROUPS.map((group, gIdx) => {
                    const groupItems = INGREDIENT_PRESETS.filter(p => p.category === group.category);
                    const filtered = groupItems.filter(p => 
                      !quickPickSearch || 
                      p.label.toLowerCase().includes(quickPickSearch.toLowerCase()) || 
                      p.name.toLowerCase().includes(quickPickSearch.toLowerCase()) ||
                      (p.aliases && p.aliases.some(a => a.toLowerCase().includes(quickPickSearch.toLowerCase())))
                    );

                    if (quickPickSearch && filtered.length === 0) return null;

                    const isExpanded = quickPickSearch ? true : (expandedCategories[group.category] ?? (gIdx === 0));

                    return (
                      <div key={gIdx} className="border border-[var(--border-color)]/60 rounded-xl overflow-hidden bg-[var(--card-bg)]/40">
                        <button
                          type="button"
                          onClick={() => setExpandedCategories(prev => ({ ...prev, [group.category]: !isExpanded }))}
                          className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-[var(--text-main)] hover:bg-orange-500/5 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{group.icon}</span>
                            <span>{group.label}</span>
                            <span className="text-[9px] font-normal text-[var(--text-muted)]">({filtered.length})</span>
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{isExpanded ? '▲' : '▼'}</span>
                        </button>

                        {isExpanded && (
                          <div className="p-2 border-t border-[var(--border-color)]/40 flex flex-wrap gap-1.5 bg-[var(--bg-color)]/30">
                            {filtered.map((preset, pIdx) => {
                              const exists = inventory.some(i => i.name.toLowerCase().trim() === preset.name.toLowerCase().trim());
                              return (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => {
                                    setNewItem({
                                      ...newItem,
                                      name: preset.name,
                                      unit: preset.unit,
                                      category: preset.category
                                    });
                                    setIngredientSearch(preset.name);
                                    setShowSuggestions(false);
                                    if (exists && showToast) {
                                      showToast(`"${preset.name}" is already in catalog!`, 'info');
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 border ${
                                    exists
                                      ? 'bg-[var(--card-bg)] text-[var(--text-muted)] border-[var(--border-color)] opacity-60'
                                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:scale-105'
                                  }`}
                                >
                                  <span>{preset.label}</span>
                                  {exists && <span className="text-[9px] text-emerald-400 font-extrabold ml-1">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Field 2, 3 & 4: Unit, Category, and Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                    Unit *
                  </label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="KG">KG (Kilograms)</option>
                    <option value="G">G (Grams)</option>
                    <option value="L">L (Liters)</option>
                    <option value="ML">ML (Milliliters)</option>
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="DOZEN">DOZEN</option>
                    <option value="BOX">BOX</option>
                    <option value="PACK">PACK</option>
                    <option value="BOTTLE">BOTTLE</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                    Category *
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="General">General</option>
                    <option value="Meat & Protein">Meat & Protein</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Dry Goods">Dry Goods</option>
                    <option value="Spices">Spices</option>
                    <option value="Sauces & Condiments">Sauces & Condiments</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Cooking Oil">Cooking Oil</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Kitchen Supplies">Kitchen Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px] flex justify-between">
                    <span>Supplier</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-normal lowercase">(Optional)</span>
                  </label>
                  <select
                    value={newItem.supplierId}
                    onChange={(e) => setNewItem({ ...newItem, supplierId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="">Select Supplier (Optional)...</option>
                    {suppliersList.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock & Cost Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newItem.stockLevel}
                    onChange={(e) => setNewItem({ ...newItem, stockLevel: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                    Minimum Stock
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newItem.minThreshold}
                    onChange={(e) => setNewItem({ ...newItem, minThreshold: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                    Cost per Unit (Rs.)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newItem.costPrice}
                    onChange={(e) => setNewItem({ ...newItem, costPrice: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)]"
                  />
                </div>
              </div>

              {/* Optional Expiry Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px] flex justify-between">
                    <span>Expiry Date (Optional)</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-normal lowercase">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={newItem.expiryDate || ''}
                    onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer font-bold"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Enter if printed on package.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px] flex justify-between">
                    <span>Notes</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-normal lowercase">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.notes || ''}
                    onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                    placeholder="Optional notes or storage instructions..."
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end items-center space-x-2 pt-3 border-t border-[var(--border-color)] shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminInventoryView;
