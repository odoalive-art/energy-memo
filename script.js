// script.js

// === Supabase 配置 (请保留你的 URL 和 KEY) ===
const SUPABASE_URL = 'https://ebwbaofzwjeypokwzvta.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_r2dimkI88sKHrNYSSXboBg_4uPQlB9m';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === 状态与变量 ===
const STATE = { energy: 100, tasks: [] };
let USER_SECRET_CODE = localStorage.getItem('nian_sync_code') || '';
let currentTab = 'todo'; // 'todo' 或 'done'

// DOM 引用
const elEnergyDisplay = document.getElementById('energy-display');
const elEnergyBar = document.getElementById('energy-bar');
const elStatusText = document.getElementById('status-text');
const elTaskList = document.getElementById('task-list');
const elSyncStatus = document.getElementById('sync-status');
const elTabTodo = document.getElementById('tab-todo');
const elTabDone = document.getElementById('tab-done');
const elTabBg = document.getElementById('tab-bg');
const elFabAdd = document.getElementById('fab-add');
const elEmptyState = document.getElementById('empty-state');

// === 初始化 ===
document.addEventListener('DOMContentLoaded', async () => {
    renderUI();
    
    if (USER_SECRET_CODE) {
        showSyncStatus('正在连接云端...', 'yellow');
        await loadFromCloud();
    } else {
        loadFromLocal();
        // 首次引导
        if(!localStorage.getItem('has_opened_before')) {
            setTimeout(openSettings, 1000);
            localStorage.setItem('has_opened_before', 'true');
        }
    }
});

// === 数据核心逻辑 (保存/读取) ===
async function saveData() {
    localStorage.setItem('healing_energy_data', JSON.stringify(STATE));
    
    if (USER_SECRET_CODE) {
        showSyncStatus('正在同步...', 'blue');
        try {
            const { error } = await supabaseClient
                .from('memo_sync')
                .upsert({ 
                    secret_code: USER_SECRET_CODE, 
                    backup_data: STATE 
                }, { onConflict: 'secret_code' });

            if (error) throw error;
            showSyncStatus('云端已同步', 'green');
        } catch (e) {
            console.error(e);
            showSyncStatus('同步失败，仅本地保存', 'red');
        }
    }
}

async function loadFromCloud() {
    try {
        const { data, error } = await supabaseClient
            .from('memo_sync')
            .select('backup_data')
            .eq('secret_code', USER_SECRET_CODE)
            .single();

        if (data && data.backup_data) {
            // 合并数据结构，防止老数据没有 tasks 字段
            STATE.energy = data.backup_data.energy || 100;
            STATE.tasks = data.backup_data.tasks || [];
            renderUI();
            saveData(); // 确保本地也是最新的
            showSyncStatus('已连接云端', 'green');
        } else {
            // 如果云端没数据，就上传本地的
            saveData();
        }
    } catch (e) {
        console.error("云端读取失败或无数据", e);
        loadFromLocal();
    }
}

function loadFromLocal() {
    const data = JSON.parse(localStorage.getItem('healing_energy_data'));
    if (data) {
        STATE.energy = data.energy;
        STATE.tasks = data.tasks || [];
        renderUI();
    }
}

// === 业务逻辑：任务管理 ===

// 切换标签页
function switchTab(tab) {
    currentTab = tab;
    
    // 更新 UI 样式
    if (tab === 'todo') {
        elTabBg.style.transform = 'translateX(0)';
        elTabTodo.className = 'flex-1 relative z-10 py-2 text-sm font-bold text-slate-700 transition-colors';
        elTabDone.className = 'flex-1 relative z-10 py-2 text-sm font-medium text-slate-400 transition-colors';
        elFabAdd.classList.remove('hidden');
    } else {
        elTabBg.style.transform = 'translateX(100%)';
        elTabTodo.className = 'flex-1 relative z-10 py-2 text-sm font-medium text-slate-400 transition-colors';
        elTabDone.className = 'flex-1 relative z-10 py-2 text-sm font-bold text-slate-700 transition-colors';
        elFabAdd.classList.add('hidden'); // 已完成页面不显示添加按钮
    }
    
    renderTaskList();
}

// 打开弹窗（可能是新增，也可能是编辑）
function openModal(taskId = null) {
    const modalTitle = document.getElementById('modal-title');
    const inputId = document.getElementById('edit-task-id');
    const inputTitle = document.getElementById('input-title');
    const inputEnergy = document.getElementById('input-energy');
    const inputDesc = document.getElementById('input-desc');
    const btnDelete = document.getElementById('btn-delete'); // 获取删除按钮

    if (taskId) {
        // === 编辑模式 ===
        const task = STATE.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        modalTitle.innerText = "编辑事项";
        inputId.value = task.id;
        inputTitle.value = task.title;
        inputEnergy.value = task.energyChange;
        inputDesc.value = task.desc;
        
        // 显示删除按钮
        btnDelete.classList.remove('hidden');
    } else {
        // === 新增模式 ===
        modalTitle.innerText = "添加新事项";
        inputId.value = '';
        inputTitle.value = '';
        inputEnergy.value = '';
        inputDesc.value = '';
        
        // 隐藏删除按钮
        btnDelete.classList.add('hidden');
    }

    const m = document.getElementById('modal');
    m.classList.remove('hidden');
    setTimeout(() => {
        m.classList.remove('opacity-0');
        document.getElementById('modal-content').classList.remove('scale-95');
    }, 10);
}

// 保存任务（新增 或 修改）
function saveTask() {
    const id = document.getElementById('edit-task-id').value;
    const title = document.getElementById('input-title').value.trim();
    const energyInput = document.getElementById('input-energy').value;
    const desc = document.getElementById('input-desc').value;

    if (!title) return document.getElementById('input-title').focus();
    
    const energyChange = energyInput ? parseInt(energyInput) : -10;

    if (id) {
        // === 修改现有任务 ===
        const taskIndex = STATE.tasks.findIndex(t => t.id == id); // 注意类型转换
        if (taskIndex > -1) {
            STATE.tasks[taskIndex].title = title;
            STATE.tasks[taskIndex].energyChange = energyChange;
            STATE.tasks[taskIndex].desc = desc;
        }
    } else {
        // === 新增任务 ===
        const newTask = {
            id: Date.now(),
            title: title,
            energyChange: energyChange,
            desc: desc,
            expanded: false,
            completed: false // 默认为未完成
        };
        STATE.tasks.unshift(newTask);
    }

    saveData();
    renderTaskList();
    closeModal();
}

// 从弹窗中删除任务
function deleteFromModal() {
    // 获取当前正在编辑的任务 ID
    const idStr = document.getElementById('edit-task-id').value;
    if (!idStr) return; // 如果没有 ID，说明是新增模式，不应该触发这里

    if (confirm('确定要彻底删除这个任务吗？此操作无法撤销。')) {
        const id = Number(idStr); // 转换成数字类型
        
        // 过滤掉这个任务
        STATE.tasks = STATE.tasks.filter(t => t.id !== id);
        
        saveData();       // 保存
        renderTaskList(); // 刷新列表
        closeModal();     // 关闭弹窗
    }
}

// 完成任务
function completeTask(id) {
    const task = STATE.tasks.find(t => t.id === id);
    if (!task) return;

    // 1. 结算能量
    updateEnergy(task.energyChange);

    // 2. 动画效果
    const domItem = document.getElementById(`task-${id}`);
    if (domItem) {
        domItem.style.opacity = '0';
        domItem.style.transform = 'scale(0.9)';
    }

    // 3. 延迟后更新数据状态（不删除，只标记）
    setTimeout(() => {
        task.completed = true;
        saveData();
        renderTaskList();
    }, 300);
}

// 恢复任务 (从已完成变回进行中)
function restoreTask(id) {
    const task = STATE.tasks.find(t => t.id === id);
    if (!task) return;

    // 也可以选择是否要撤销能量变动？这里暂不撤销，只恢复任务
    task.completed = false;
    saveData();
    switchTab('todo'); // 自动跳回代办页
}

// 物理删除任务 (仅在已完成列表里提供)
function deleteTask(id) {
    if(!confirm('确定要彻底删除这个任务吗？')) return;
    STATE.tasks = STATE.tasks.filter(t => t.id !== id);
    saveData();
    renderTaskList();
}

function updateEnergy(delta) {
    let newEnergy = STATE.energy + delta;
    STATE.energy = Math.max(0, Math.min(100, newEnergy));
    renderEnergy();
    saveData();
}

function toggleExpand(id) {
    const task = STATE.tasks.find(t => t.id === id);
    if (task) {
        task.expanded = !task.expanded;
        renderTaskList();
    }
}

function closeModal() {
    const m = document.getElementById('modal');
    m.classList.add('opacity-0');
    document.getElementById('modal-content').classList.add('scale-95');
    setTimeout(() => m.classList.add('hidden'), 300);
}

// 设置相关
function openSettings() {
    document.getElementById('sync-code-input').value = USER_SECRET_CODE;
    document.getElementById('settings-modal').classList.remove('hidden');
}

function saveSyncCode() {
    const code = document.getElementById('sync-code-input').value.trim();
    if (code) {
        USER_SECRET_CODE = code;
        localStorage.setItem('nian_sync_code', code);
        document.getElementById('settings-modal').classList.add('hidden');
        loadFromCloud();
    } else {
        alert("请输入暗号，或者点击关闭以继续离线使用");
    }
}

function showSyncStatus(text, color) {
    elSyncStatus.style.opacity = '1';
    elSyncStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-${color}-400"></span> ${text}`;
    setTimeout(() => {
        if(color === 'green') elSyncStatus.style.opacity = '0';
    }, 3000);
}

// === 渲染 UI ===
function renderUI() {
    renderEnergy();
    renderTaskList();
}

function renderEnergy() {
    elEnergyDisplay.innerText = STATE.energy;
    elEnergyBar.style.width = `${STATE.energy}%`;
    
    if (STATE.energy >= 70) {
        elEnergyBar.className = 'energy-bar-fill h-full w-full rounded-full bg-orange-400';
        document.body.style.backgroundColor = '#fff7ed';
        elStatusText.innerText = "状态极佳 🔥";
    } else if (STATE.energy <= 30) {
        elEnergyBar.className = 'energy-bar-fill h-full w-full rounded-full bg-blue-400';
        document.body.style.backgroundColor = '#f1f5f9';
        elStatusText.innerText = "需要休息 💤";
    } else {
        elEnergyBar.className = 'energy-bar-fill h-full w-full rounded-full bg-emerald-400';
        document.body.style.backgroundColor = '#fdfcf8';
        elStatusText.innerText = "平稳运行 🌱";
    }
}

function renderTaskList() {
    elTaskList.innerHTML = '';
    
    // 核心筛选逻辑：根据 currentTab 筛选
    const filteredTasks = STATE.tasks.filter(t => {
        if (currentTab === 'todo') return !t.completed;
        if (currentTab === 'done') return t.completed;
        return true;
    });

    if (filteredTasks.length === 0) {
        elEmptyState.classList.remove('hidden');
        elEmptyState.classList.add('flex');
    } else {
        elEmptyState.classList.add('hidden');
        elEmptyState.classList.remove('flex');
    }

    filteredTasks.forEach(task => {
        const isNegative = task.energyChange < 0;
        const sign = task.energyChange > 0 ? '+' : '';
        const mdContent = task.desc ? marked.parse(task.desc) : '无备注';

        const li = document.createElement('li');
        li.id = `task-${task.id}`;
        li.className = `bg-white rounded-2xl p-5 shadow-sm transition-all duration-300 group border border-transparent ${task.completed ? 'opacity-60 grayscale' : 'hover:shadow-md hover:border-orange-100'}`;
        
        // 动态生成操作按钮（根据是否完成）
        let actionBtn = '';
        if (!task.completed) {
            actionBtn = `
                <button onclick="event.stopPropagation(); completeTask(${task.id})" 
                    class="w-10 h-10 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
                    ✓
                </button>`;
        } else {
            // 已完成页面的按钮：恢复 & 删除
            actionBtn = `
                <div class="flex gap-2">
                    <button onclick="event.stopPropagation(); restoreTask(${task.id})" class="text-xs px-3 py-1 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200">恢复</button>
                    <button onclick="event.stopPropagation(); deleteTask(${task.id})" class="text-xs px-3 py-1 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100">删除</button>
                </div>
            `;
        }

        // 编辑按钮 (仅在展开且未完成时显示)
        const editBtn = (!task.completed && task.expanded) 
            ? `<button onclick="openModal(${task.id})" class="mt-4 w-full py-2 rounded-xl bg-slate-50 text-slate-500 text-sm font-medium hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                编辑内容
               </button>` 
            : '';

        li.innerHTML = `
            <div class="flex justify-between items-start cursor-pointer" onclick="toggleExpand(${task.id})">
                <div class="flex-1 pr-4">
                    <h3 class="font-bold text-slate-700 text-lg leading-tight mb-1 ${task.completed ? 'line-through text-slate-400' : ''}">${task.title}</h3>
                    <div class="text-xs font-medium ${isNegative ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50'} inline-block px-2 py-1 rounded-md">
                        ⚡ ${sign}${task.energyChange}
                    </div>
                </div>
                ${actionBtn}
            </div>
            
            <div class="${task.expanded ? 'block' : 'hidden'} mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 markdown-body">
                ${mdContent}
                ${editBtn}
            </div>
            
            ${!task.expanded && task.desc ? `<p class="mt-2 text-xs text-slate-400 truncate" onclick="toggleExpand(${task.id})">${task.desc}</p>` : ''}
        `;
        elTaskList.appendChild(li);
    });
}