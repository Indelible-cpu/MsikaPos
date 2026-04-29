import re

with open('c:/MsikaPos/frontend/src/pages/PublicStorefront.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { AuditService } from '../services/AuditService';",
    "import { AuditService } from '../services/AuditService';\nimport { formatCurrency } from '../utils/phoneUtils';\nimport { db } from '../db/posDB';"
)

# 2. State
state_block = """  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'medium');
  const [taxConfig, setTaxConfig] = useState<{ rate: number, inclusive: boolean }>({ rate: 0, inclusive: true });
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);"""
content = content.replace(
    "  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'medium');",
    state_block
)

# 3. Load Storefront settings
load_settings = """        if (s.logo) setShopLogo(s.logo);
      }
      
      const localTax = await db.settings.get('tax_config');
      if (localTax?.value) setTaxConfig(localTax.value as { rate: number; inclusive: boolean });
      
      const localDiscount = await db.settings.get('global_discount');
      if (localDiscount?.value) setGlobalDiscount(localDiscount.value as number);"""
content = content.replace(
    "        if (s.logo) setShopLogo(s.logo);\n      }",
    load_settings
)

# 4. Subtitle
content = content.replace(
    """<h2 className="text-xs md:text-sm font-black tracking-tighter leading-none text-primary-500">Market place</h2>
            <p className="text-[7px] md:text-[9px] font-bold text-surface-text/40 mt-1 uppercase tracking-widest">Search</p>""",
    """<h2 className="text-sm md:text-lg font-black tracking-tighter leading-none text-primary-500">Market place</h2>
            <p className="text-[7px] md:text-[9px] font-bold text-surface-text/40 mt-1 lowercase tracking-widest">premium products & services</p>"""
)

# 5. Product Top Badge
content = content.replace(
    "{p.isService ? 'SERVICE' : 'STOCK'}",
    "{p.isService ? 'Service' : 'Product'}"
)

# 6. Product Name & Stock
name_stock = """<h3 className="font-black text-xs md:text-lg tracking-tight leading-tight group-hover:text-primary-500 transition-colors mb-2">
                      {p.name.charAt(0).toUpperCase() + p.name.slice(1).toLowerCase()}
                    </h3>
                    {!p.isService && p.quantity !== undefined && (
                      <div className={`text-[9px] font-black tracking-widest ${p.quantity > 2 ? 'text-green-500' : 'text-yellow-500'}`}>
                        {p.quantity > 2 ? '(In Stock)' : '(Low Stock)'}
                      </div>
                    )}"""
content = re.sub(
    r'<h3 className="font-black text-xs md:text-lg tracking-tight leading-tight group-hover:text-primary-500 transition-colors mb-2">\{p\.name\}</h3>',
    name_stock,
    content
)

# 7. Price Row
price_row_orig = """<div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[7px] md:text-[9px] font-black text-surface-text/20">PRICE</span>
                        <p className="text-sm md:text-xl font-black text-primary-500 tracking-tighter">mk{Number(p.sellPrice ?? 0).toLocaleString()}</p>
                      </div>"""
price_row_new = """<div className="flex items-start justify-between w-full">
                      <div className="flex flex-col">
                        <span className="text-[7px] md:text-[9px] font-black text-surface-text/20">PRICE</span>
                        <p className={`text-sm md:text-xl font-black tracking-tighter ${globalDiscount > 0 ? 'text-surface-text/40 line-through text-xs md:text-sm' : 'text-primary-500'}`}>
                          {formatCurrency(Number(p.sellPrice ?? 0))}
                        </p>
                      </div>
                      {globalDiscount > 0 && (
                        <div className="flex flex-col items-end pl-2">
                          <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-lg mb-1">{globalDiscount}% OFF</span>
                          <span className="text-sm md:text-xl font-black text-red-500 tracking-tighter">{formatCurrency(Number(p.sellPrice ?? 0) * (1 - globalDiscount / 100))}</span>
                        </div>
                      )}"""
content = content.replace(price_row_orig, price_row_new)

# 8. WhatsApp Button
wa_btn_orig = 'className="py-3 bg-emerald-500 text-white rounded-xl text-[8px] font-black tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-emerald-500/10"'
wa_btn_new = 'className="w-8 md:w-10 h-8 md:h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"'
content = content.replace(wa_btn_orig, wa_btn_new)

# 9. Interface update
content = content.replace("isService?: boolean;", "isService?: boolean;\n  quantity?: number;")

# 10. Cart Item Name & Price
content = content.replace(
    '<h4 className="font-black text-sm truncate">{item.name}</h4>',
    '<h4 className="font-black text-sm truncate">{item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase()}</h4>'
)
content = content.replace(
    '<p className="text-xs font-bold text-surface-text/40">mk{Number(item.sellPrice ?? 0).toLocaleString()}</p>',
    '<p className="text-xs font-bold text-surface-text/40">{formatCurrency(Number(item.sellPrice ?? 0))}</p>'
)

# 11. Cart Total logic
cart_total_orig = """<div className="flex items-center justify-between">
                <p className="text-sm font-black text-surface-text/40">Estimated Total</p>
                <p className="text-2xl font-black text-primary-500 tracking-tighter">
                  MK {cartItems.reduce((acc, item) => acc + Number(item.sellPrice ?? 0), 0).toLocaleString()}
                </p>
              </div>"""
cart_total_new = """{(() => {
                const subtotal = cartItems.reduce((acc, item) => {
                  const price = Number(item.sellPrice ?? 0);
                  const discountedPrice = price * (1 - globalDiscount / 100);
                  return acc + discountedPrice;
                }, 0);
                let taxAmount = 0;
                let total = subtotal;
                if (taxConfig.rate > 0) {
                  if (taxConfig.inclusive) {
                    taxAmount = subtotal - (subtotal / (1 + (taxConfig.rate / 100)));
                  } else {
                    taxAmount = subtotal * (taxConfig.rate / 100);
                    total = subtotal + taxAmount;
                  }
                }
                return (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-xs font-black text-surface-text/40">
                      <span>Subtotal {globalDiscount > 0 && `(with ${globalDiscount}% discount)`}</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {taxConfig.rate > 0 && (
                      <div className="flex items-center justify-between text-xs font-black text-surface-text/40">
                        <span>Tax ({taxConfig.rate}% {taxConfig.inclusive ? 'Inc.' : 'Exc.'})</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-surface-border pt-2 mt-1">
                      <p className="text-sm font-black text-surface-text/40">Estimated Total</p>
                      <p className="text-2xl font-black text-primary-500 tracking-tighter">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                );
              })()}"""
content = content.replace(cart_total_orig, cart_total_new)

with open('c:/MsikaPos/frontend/src/pages/PublicStorefront.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
