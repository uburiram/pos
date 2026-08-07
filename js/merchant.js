const socket = io();
let orders = [];
let currentFilter = 'active';

const statusMap = {
  pending: 'รอชำระ/รับ',
  paid: 'ชำระแล้ว',
  preparing: 'กำลังทำ',
  ready: 'พร้อมรับ',
  completed: 'เสร็จ',
  cancelled: 'ยกเลิก'
};

socket.on('connect', () => {
  document.getElementById('conn-status').textContent = 'Online';
  document.getElementById('conn-status').className = 'badge online';
});

socket.on('disconnect', () => {
  document.getElementById('conn-status').textContent = 'Offline';
  document.getElementById('conn-status').className = 'badge offline';
});

socket.on('orders-sync', (data) => {
  orders = data;
  render();
});

socket.on('new-order', (order) => {
  orders.unshift(order);
  playSound();
  // แจ้งเตือน browser (ถ้าอนุญาต)
  if (Notification.permission === 'granted') {
    new Notification('ออเดอร์ใหม่! คิว ' + order.queueNumber, {
      body: order.items.map(i => i.name + ' x' + i.qty).join(', ') + ' = ' + order.total + ' บาท',
      vibrate: [200, 100, 200]
    });
  }
  render();
});

socket.on('order-updated', (order) => {
  const idx = orders.findIndex(o => o.id === order.id);
  if (idx >= 0) orders[idx] = order;
  render();
});

function playSound() {
  const audio = document.getElementById('notify-sound');
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
  // fallback vibration
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function render() {
  const list = document.getElementById('orders-list');
  let filtered = orders;
  if (currentFilter === 'active') {
    filtered = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  } else if (currentFilter === 'completed') {
    filtered = orders.filter(o => o.status === 'completed');
  }

  document.getElementById('order-count').textContent = filtered.length + ' ออเดอร์';

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">ไม่มีออเดอร์ในหมวดนี้</p>';
    return;
  }

  list.innerHTML = filtered.map(o => {
    const time = new Date(o.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const items = o.items.map(i => `<li>${i.name} x${i.qty}</li>`).join('');
    let actions = '';
    if (o.status === 'pending') {
      actions = `
        <button class="btn-paid" onclick="updateStatus(${o.id},'paid')">ชำระแล้ว</button>
        <button class="btn-prep" onclick="updateStatus(${o.id},'preparing')">เริ่มทำ</button>
        <button class="btn-cancel-order" onclick="updateStatus(${o.id},'cancelled')">ยกเลิก</button>
      `;
    } else if (o.status === 'paid') {
      actions = `
        <button class="btn-prep" onclick="updateStatus(${o.id},'preparing')">เริ่มทำ</button>
        <button class="btn-cancel-order" onclick="updateStatus(${o.id},'cancelled')">ยกเลิก</button>
      `;
    } else if (o.status === 'preparing') {
      actions = `
        <button class="btn-ready" onclick="updateStatus(${o.id},'ready')">พร้อมรับ</button>
      `;
    } else if (o.status === 'ready') {
      actions = `
        <button class="btn-done" onclick="updateStatus(${o.id},'completed')">เสร็จสิ้น</button>
      `;
    }

    return `
      <div class="order-card ${o.status}">
        <div class="order-header">
          <div class="order-queue">คิว ${o.queueNumber}</div>
          <div>
            <span class="status-label status-${o.status}">${statusMap[o.status] || o.status}</span>
            <div class="order-time">${time}</div>
          </div>
        </div>
        <ul class="order-items">${items}</ul>
        <div class="order-total">${o.total} บาท</div>
        <div class="order-meta">
          ${o.customerName || 'ลูกค้า'}${o.note ? ' | ' + o.note : ''}
        </div>
        <div class="order-actions">${actions}</div>
      </div>
    `;
  }).join('');
}

async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('อัปเดตไม่สำเร็จ');
  } catch (err) {
    alert(err.message);
  }
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ขอ permission notification
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Keep screen awake (ถ้า support)
if ('wakeLock' in navigator) {
  navigator.wakeLock.request('screen').catch(() => {});
}
