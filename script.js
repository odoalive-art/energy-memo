        // ==========================================
        // ⚠️ 请在此处填入你的 Supabase 配置 (注意单引号)
        // ==========================================
        const SUPABASE_URL = 'https://ebwbaofzwjeypokwzvta.supabase.co'; 
        const SUPABASE_KEY = 'sb_publishable_r2dimkI88sKHrNYSSXboBg_4uPQlB9m';
        // ==========================================

        // 修复：改用 client 变量名，防止和 CDN 全局变量冲突
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const STATE = { energy: 100, tasks: [] };
        let USER_SECRET_CODE = localStorage.getItem('nian_sync_code') || '';

        const elEnergyDisplay = document.getElementById('energy-display');
        const elEnergyBar = document.getElementById('energy-bar');
        const elStatusText = document.getElementById('status-text');
        const elTaskList = document.getElementById('task-list');
        const elSyncStatus = document.getElementById('sync-status');

        document.addEventListener('DOMContentLoaded', async () => {
            renderUI();
            
            if (USER_SECRET_CODE) {
                showSyncStatus('正在连接云端...', 'yellow');
                await loadFromCloud();
            } else {
                loadFromLocal();
                if(!localStorage.getItem('has_opened_before')) {
                    setTimeout(openSettings, 1000);
                    localStorage.setItem('has_opened_before', 'true');
                }
            }
        });

        async function saveData() {
            localStorage.setItem('healing_energy_data', JSON.stringify(STATE));
            
            if (USER_SECRET_CODE) {
                showSyncStatus('正在同步...', 'blue');
                try {
                    // 使用 supabaseClient 而不是 supabase
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
                // 使用 supabaseClient 而不是 supabase
                const { data, error } = await supabaseClient
                    .from('memo_sync')
                    .select('backup_data')
                    .eq('secret_code', USER_SECRET_CODE)
                    .single();

                if (data && data.backup_data) {
                    STATE.energy = data.backup_data.energy;
                    STATE.tasks = data.backup_data.tasks;
                    renderUI();
                    saveData();
                    showSyncStatus('已连接云端', 'green');
                } else {
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
                STATE.tasks = data.tasks;
                renderUI();
            }
        }

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

        function updateEnergy(delta) {
            let newEnergy = STATE.energy + delta;
            STATE.energy = Math.max(0, Math.min(100, newEnergy));
            renderEnergy();
            saveData();
        }

        function addTask() {
            const title = document.getElementById('input-title').value.trim();
            const energyInput = document.getElementById('input-energy').value;
            const desc = document.getElementById('input-desc').value;

            if (!title) return document.getElementById('input-title').focus();
            
            const newTask = {
                id: Date.now(),
                title: title,
                energyChange: energyInput ? parseInt(energyInput) : -10,
                desc: desc,
                expanded: false
            };

            STATE.tasks.unshift(newTask);
            saveData();
            renderTaskList();
            closeModal();
            
            document.getElementById('input-title').value = '';
            document.getElementById('input-energy').value = '';
            document.getElementById('input-desc').value = '';
        }

        function completeTask(id) {
            const task = STATE.tasks.find(t => t.id === id);
            if (!task) return;
            
            updateEnergy(task.energyChange);

            const domItem = document.getElementById(`task-${id}`);
            domItem.style.opacity = '0';
            domItem.style.transform = 'scale(0.9)';

            setTimeout(() => {
                STATE.tasks = STATE.tasks.filter(t => t.id !== id);
                saveData();
                renderTaskList();
            }, 300);
        }

        function toggleExpand(id) {
            const task = STATE.tasks.find(t => t.id === id);
            if (task) {
                task.expanded = !task.expanded;
                renderTaskList();
            }
        }

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
            STATE.tasks.forEach(task => {
                const isNegative = task.energyChange < 0;
                const sign = task.energyChange > 0 ? '+' : '';
                const mdContent = task.desc ? marked.parse(task.desc) : '';

                const li = document.createElement('li');
                li.id = `task-${task.id}`;
                li.className = 'bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group';
                li.innerHTML = `
                    <div class="flex justify-between items-start cursor-pointer" onclick="toggleExpand(${task.id})">
                        <div class="flex-1 pr-4">
                            <h3 class="font-bold text-slate-700 text-lg leading-tight mb-1">${task.title}</h3>
                            <div class="text-xs font-medium ${isNegative ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50'} inline-block px-2 py-1 rounded-md">
                                ⚡ ${sign}${task.energyChange}
                            </div>
                        </div>
                        <button onclick="event.stopPropagation(); completeTask(${task.id})" 
                            class="w-10 h-10 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
                            ✓
                        </button>
                    </div>
                    ${task.expanded && task.desc ? `<div class="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 markdown-body">${mdContent}</div>` : ''}
                    ${!task.expanded && task.desc ? `<p class="mt-2 text-xs text-slate-400 truncate" onclick="toggleExpand(${task.id})">${task.desc}</p>` : ''}
                `;
                elTaskList.appendChild(li);
            });
        }

        function openModal() {
            const m = document.getElementById('modal');
            m.classList.remove('hidden');
            setTimeout(() => {
                m.classList.remove('opacity-0');
                document.getElementById('modal-content').classList.remove('scale-95');
            }, 10);
        }
        function closeModal() {
            const m = document.getElementById('modal');
            m.classList.add('opacity-0');
            document.getElementById('modal-content').classList.add('scale-95');
            setTimeout(() => m.classList.add('hidden'), 300);
        }
