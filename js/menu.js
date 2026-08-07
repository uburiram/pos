const cart = {}; // { id: qty }

async function loadMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  document.getElementById('shop-name').textContent = data.shopName;
  const list = document.getElementById('menu-list');
  list.innerHTML = '';
  data.menu.forEach(item => {
    const div = document.createElement('div');
    div.className = 'menu-item';
    div.innerHTML = `
      <div class="info">
        <h3>${item.name}</h3>
        <div class="price">${item.price} บาท</div>
        <div class="cat">${item.category}</div>
      </div>
      <div class="qty-control">
        <button data-id="${item.id}" data-action="minus">−</button>
        <span id="qty-${item.id}">0</span>
        <button data-id="${item.id}" data-action="plus">+</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const action = btn.dataset.action;
    if (action === 'plus') {
      cart[id] = (cart[id] || 0) + 1;
    } else if (action === 'minus' && cart[id]) {
      cart[id]--;
      if (cart[id] <= 0) delete cart[id];
    }
    updateCartUI(data.menu);
  });
}

function updateCartUI(menu) {
  let count = 0, total = 0;
  Object.keys(cart).forEach(id => {
    const item = menu.find(m => m.id === parseInt(id));
    if (item) {
      count += cart[id];
      total += item.price * cart[id];
    }
    const el = document.getElementById(`qty-${id}`);
    if (el) el.textContent = cart[id] || 0;
  });
  // update all qty displays
  menu.forEach(m => {
    const el = document.getElementById(`qty-${m.id}`);
    if (el) el.textContent = cart[m.id] || 0;
  });

  const bar = document.getElementById('cart-bar');
  if (count > 0) {
    bar.classList.remove('hidden');
    document.getElementById('cart-count').textContent = count + ' รายการ';
    document.getElementById('cart-total').textContent = total + ' บาท';
  } else {
    bar.classList.add('hidden');
  }
  window._menu = menu;
  window._total = total;
}

document.getElementById('btn-checkout').addEventListener('click', () => {
  const menu = window._menu || [];
  const itemsHtml = Object.keys(cart).map(id => {
    const item = menu.find(m => m.id === parseInt(id));
    return `<div>${item.name} x${cart[id]} = ${item.price * cart[id]} บาท</div>`;
  }).join('');
  document.getElementById('checkout-items').innerHTML = itemsHtml;
  document.getElementById('checkout-total').textContent = window._total;
  document.getElementById('checkout-modal').classList.remove('hidden');
});

document.getElementById('btn-cancel').addEventListener('click', () => {
  document.getElementById('checkout-modal').classList.add('hidden');
});

document.getElementById('btn-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm');
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง...';

  const items = Object.keys(cart).map(id => ({
    id: parseInt(id),
    qty: cart[id]
  }));

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        customerName: document.getElementById('customer-name').value.trim(),
        note: document.getElementById('order-note').value.trim()
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'สั่งไม่สำเร็จ');

    // แสดงผล
    document.getElementById('checkout-modal').classList.add('hidden');
    document.getElementById('result-queue').textContent = data.order.queueNumber;
    document.getElementById('result-total').textContent = data.order.total;
    document.getElementById('promptpay-qr').src = data.promptpayQR;
    document.getElementById('result-note').textContent = 'คิว ' + data.order.queueNumber + ' | ชำระแล้วแจ้งพ่อค้า';
    document.getElementById('result-modal').classList.remove('hidden');

    // ล้างตะกร้า
    Object.keys(cart).forEach(k => delete cart[k]);
    updateCartUI(window._menu || []);
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'ยืนยันสั่ง + ชำระเงิน';
  }
});

document.getElementById('btn-done').addEventListener('click', () => {
  document.getElementById('result-modal').classList.add('hidden');
});

loadMenu();
