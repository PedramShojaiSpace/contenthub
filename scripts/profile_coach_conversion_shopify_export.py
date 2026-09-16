import csv
import json
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

INPUT = Path('/home/ubuntu/upload/orders_export_1(2).csv')
OUTPUT = Path('/home/ubuntu/coach_conversion_shopify_export_profile.json')


def money(value: str) -> Decimal:
    try:
        return Decimal((value or '0').strip() or '0')
    except InvalidOperation:
        return Decimal('0')


def main() -> None:
    rows = list(csv.DictReader(INPUT.open(newline='', encoding='utf-8-sig')))
    orders: dict[str, dict] = {}
    products: Counter[tuple[str, str]] = Counter()
    product_revenue: defaultdict[tuple[str, str], Decimal] = defaultdict(Decimal)
    status_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()

    for row in rows:
        order_id = (row.get('Id') or '').strip()
        if not order_id:
            continue
        status = (row.get('Financial Status') or '').strip().lower()
        status_counts[status] += 1
        source_counts[(row.get('Source') or '').strip() or 'unknown'] += 1
        product_key = ((row.get('Lineitem name') or '').strip(), (row.get('Lineitem sku') or '').strip())
        quantity = int((row.get('Lineitem quantity') or '0').strip() or '0')
        products[product_key] += quantity
        product_revenue[product_key] += money(row.get('Lineitem price')) * quantity - money(row.get('Lineitem discount'))
        if order_id not in orders:
            orders[order_id] = {
                'status': status,
                'total': money(row.get('Total')),
                'refunded': money(row.get('Refunded Amount')),
                'source': (row.get('Source') or '').strip() or 'unknown',
                'line_items': 0,
            }
        orders[order_id]['line_items'] += 1

    order_statuses = Counter(order['status'] for order in orders.values())
    order_sources = Counter(order['source'] for order in orders.values())
    output = {
        'source_file': INPUT.name,
        'raw_line_rows': len(rows),
        'unique_orders': len(orders),
        'unique_orders_by_financial_status': dict(order_statuses),
        'unique_orders_by_source': dict(order_sources),
        'line_rows_by_financial_status': dict(status_counts),
        'line_rows_by_source': dict(source_counts),
        'total_order_value_by_financial_status': {
            status: f"{sum((order['total'] for order in orders.values() if order['status'] == status), Decimal('0')):.2f}"
            for status in sorted(order_statuses)
        },
        'total_refunded_by_financial_status': {
            status: f"{sum((order['refunded'] for order in orders.values() if order['status'] == status), Decimal('0')):.2f}"
            for status in sorted(order_statuses)
        },
        'products': [
            {
                'name': name,
                'sku': sku or None,
                'quantity': products[(name, sku)],
                'gross_line_value_after_line_discount': f"{product_revenue[(name, sku)]:.2f}",
            }
            for name, sku in sorted(products, key=lambda key: (-products[key], key[0].lower(), key[1].lower()))
        ],
    }
    OUTPUT.write_text(json.dumps(output, indent=2), encoding='utf-8')
    print(OUTPUT)


if __name__ == '__main__':
    main()
