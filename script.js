/**
 * 2048 AI 助手
 * 使用启发式评估函数 + 期望 Minimax 算法
 */

class Game2048 {
    constructor() {
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.mode = 'manual'; // 'manual' or 'ai'
        this.isAutoPlaying = false;
        this.autoPlayInterval = null;
        
        this.init();
    }
    
    init() {
        this.createGrid();
        this.bindEvents();
        this.updateDisplay();
    }
    
    createGrid() {
        const gridEl = document.getElementById('grid');
        gridEl.innerHTML = '';
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.value = 0;
                cell.innerHTML = `
                    <span class="decrease">-</span>
                    <span class="value"></span>
                    <span class="increase">+</span>
                `;
                
                // Click handlers
                const decrease = cell.querySelector('.decrease');
                const increase = cell.querySelector('.increase');
                
                decrease.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.changeValue(r, c, -1);
                });
                
                increase.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.changeValue(r, c, 1);
                });
                
                gridEl.appendChild(cell);
            }
        }
    }
    
    changeValue(row, col, delta) {
        let current = this.grid[row][col];
        if (current === 0 && delta < 0) return;
        
        if (current === 0) {
            current = 2;
        } else if (delta > 0) {
            current *= 2;
        } else {
            current /= 2;
        }
        
        // Cap at reasonable value
        if (current > 131072) current = 131072;
        if (current < 0) current = 0;
        
        this.grid[row][col] = current;
        this.updateDisplay();
        this.calculateScore();
    }
    
    updateDisplay() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            const r = Math.floor(index / 4);
            const c = index % 4;
            const value = this.grid[r][c];
            
            cell.dataset.value = value;
            cell.querySelector('.value').textContent = value === 0 ? '' : value;
            
            // Update colors
            cell.className = 'cell' + (value === 0 ? '' : ' new');
        });
    }
    
    calculateScore() {
        this.score = this.grid.flat().reduce((a, b) => a + b, 0);
        document.getElementById('score').textContent = this.score;
    }
    
    reset() {
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.stopAutoPlay();
        this.updateDisplay();
        this.calculateScore();
        document.getElementById('suggestion').textContent = '点击 "AI 走一步"';
        document.getElementById('suggestionScore').textContent = '';
        this.clearArrows();
    }
    
    // ==================== Game Logic ====================
    
    cloneGrid(grid) {
        return grid.map(row => [...row]);
    }
    
    // Check if two grids are equal
    gridsEqual(a, b) {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (a[r][c] !== b[r][c]) return false;
            }
        }
        return true;
    }
    
    // Move in a direction, return { moved: boolean, score: number, grid: newGrid }
    move(grid, direction) {
        const newGrid = this.cloneGrid(grid);
        let moved = false;
        let score = 0;
        
        const rotate = (g, times) => {
            let result = g;
            for (let i = 0; i < times; i++) {
                result = result[0].map((_, idx) => result.map(row => row[idx]).reverse());
            }
            return result;
        };
        
        // Rotate to make "left" the operation direction
        const rotations = { 0: 0, 1: 3, 2: 2, 3: 1 }; // left, up, right, down
        let rotated = rotate(newGrid, rotations[direction]);
        
        // Process each row
        for (let r = 0; r < 4; r++) {
            let row = rotated[r].filter(v => v !== 0);
            
            // Merge
            for (let i = 0; i < row.length - 1; i++) {
                if (row[i] === row[i + 1]) {
                    row[i] *= 2;
                    score += row[i];
                    row[i + 1] = 0;
                }
            }
            
            row = row.filter(v => v !== 0);
            
            // Pad with zeros
            while (row.length < 4) {
                row.push(0);
            }
            
            // Check if moved
            for (let c = 0; c < 4; c++) {
                if (rotated[r][c] !== row[c]) moved = true;
                rotated[r][c] = row[c];
            }
        }
        
        // Rotate back
        const reverseRotations = { 0: 0, 1: 1, 2: 2, 3: 3 };
        const result = rotate(rotated, reverseRotations[direction]);
        
        return { moved, score, grid: result };
    }
    
    // Get available moves
    getAvailableMoves(grid) {
        const moves = [];
        for (let dir = 0; dir < 4; dir++) {
            const result = this.move(grid, dir);
            if (result.moved) {
                moves.push(dir);
            }
        }
        return moves;
    }
    
    // Add random tile (for simulation)
    addRandomTile(grid) {
        const empty = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (grid[r][c] === 0) empty.push({ r, c });
            }
        }
        
        if (empty.length === 0) return grid;
        
        const pos = empty[Math.floor(Math.random() * empty.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        
        const newGrid = this.cloneGrid(grid);
        newGrid[pos.r][pos.c] = value;
        return newGrid;
    }
    
    // ==================== AI Evaluation ====================
    
    evaluate(grid) {
        // Weights for different heuristics
        const WEIGHTS = {
            empty: 270,
            smoothness: 10,
            monotonicity: 47,
            maxValue: 11,
            corner: 100
        };
        
        const emptyCells = this.countEmpty(grid);
        const smoothness = this.calculateSmoothness(grid);
        const monotonicity = this.calculateMonotonicity(grid);
        const maxValue = Math.max(...grid.flat());
        const cornerBonus = this.cornerBonus(grid, maxValue);
        
        return WEIGHTS.empty * emptyCells +
               WEIGHTS.smoothness * smoothness +
               WEIGHTS.monotonicity * monotonicity +
               WEIGHTS.maxValue * Math.log2(maxValue || 1) +
               WEIGHTS.corner * cornerBonus;
    }
    
    countEmpty(grid) {
        return grid.flat().filter(v => v === 0).length;
    }
    
    // Smaller differences between adjacent cells = smoother
    calculateSmoothness(grid) {
        let smoothness = 0;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (grid[r][c] === 0) continue;
                const value = Math.log2(grid[r][c]);
                
                // Right neighbor
                if (c < 3 && grid[r][c + 1] !== 0) {
                    smoothness -= Math.abs(value - Math.log2(grid[r][c + 1]));
                }
                
                // Down neighbor
                if (r < 3 && grid[r + 1][c] !== 0) {
                    smoothness -= Math.abs(value - Math.log2(grid[r + 1][c]));
                }
            }
        }
        return smoothness;
    }
    
    // Monotonicity: values should increase/decrease in a pattern
    calculateMonotonicity(grid) {
        let totals = [0, 0, 0, 0]; // left, right, up, down
        
        // Left/right
        for (let r = 0; r < 4; r++) {
            let current = 0;
            let next = current + 1;
            while (next < 4) {
                while (next < 4 && grid[r][next] === 0) next++;
                if (next >= 4) break;
                const currentVal = grid[r][current] ? Math.log2(grid[r][current]) : 0;
                const nextVal = grid[r][next] ? Math.log2(grid[r][next]) : 0;
                if (currentVal > nextVal) totals[0] += nextVal - currentVal;
                else if (nextVal > currentVal) totals[1] += currentVal - nextVal;
                current = next;
                next++;
            }
        }
        
        // Up/down
        for (let c = 0; c < 4; c++) {
            let current = 0;
            let next = current + 1;
            while (next < 4) {
                while (next < 4 && grid[next][c] === 0) next++;
                if (next >= 4) break;
                const currentVal = grid[current][c] ? Math.log2(grid[current][c]) : 0;
                const nextVal = grid[next][c] ? Math.log2(grid[next][c]) : 0;
                if (currentVal > nextVal) totals[2] += nextVal - currentVal;
                else if (nextVal > currentVal) totals[3] += currentVal - nextVal;
                current = next;
                next++;
            }
        }
        
        return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
    }
    
    cornerBonus(grid, maxValue) {
        const corners = [
            grid[0][0], grid[0][3],
            grid[3][0], grid[3][3]
        ];
        return corners.includes(maxValue) ? 1 : 0;
    }
    
    // ==================== AI Search ====================
    
    search(grid, depth, alpha, beta, isPlayer) {
        if (depth === 0) {
            return { score: this.evaluate(grid), direction: -1 };
        }
        
        if (isPlayer) {
            // Player's turn: choose best move
            let bestScore = -Infinity;
            let bestDirection = -1;
            
            const moves = this.getAvailableMoves(grid);
            if (moves.length === 0) {
                return { score: -Infinity, direction: -1 }; // Game over
            }
            
            for (const dir of moves) {
                const result = this.move(grid, dir);
                const searchResult = this.search(result.grid, depth - 1, alpha, beta, false);
                
                if (searchResult.score > bestScore) {
                    bestScore = searchResult.score;
                    bestDirection = dir;
                }
                
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break;
            }
            
            return { score: bestScore, direction: bestDirection };
        } else {
            // Computer's turn: random tile placement (expectimax)
            const emptyCells = [];
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (grid[r][c] === 0) emptyCells.push({ r, c });
                }
            }
            
            if (emptyCells.length === 0) {
                return this.search(grid, depth - 1, alpha, beta, true);
            }
            
            // Average over possible tile placements (simplified)
            let totalScore = 0;
            const sampleSize = Math.min(emptyCells.length, 4);
            
            for (let i = 0; i < sampleSize; i++) {
                const pos = emptyCells[Math.floor(i * emptyCells.length / sampleSize)];
                
                // 90% chance of 2, 10% chance of 4
                const newGrid2 = this.cloneGrid(grid);
                newGrid2[pos.r][pos.c] = 2;
                const result2 = this.search(newGrid2, depth - 1, alpha, beta, true);
                
                const newGrid4 = this.cloneGrid(grid);
                newGrid4[pos.r][pos.c] = 4;
                const result4 = this.search(newGrid4, depth - 1, alpha, beta, true);
                
                totalScore += 0.9 * result2.score + 0.1 * result4.score;
            }
            
            return { score: totalScore / sampleSize, direction: -1 };
        }
    }
    
    getBestMove() {
        // Adaptive depth based on empty cells
        const emptyCount = this.countEmpty(this.grid);
        let depth = 3;
        if (emptyCount > 8) depth = 4;
        if (emptyCount > 12) depth = 5;
        
        const result = this.search(this.grid, depth, -Infinity, Infinity, true);
        return result;
    }
    
    // ==================== Actions ====================
    
    aiStep() {
        const result = this.getBestMove();
        
        if (result.direction === -1) {
            document.getElementById('suggestion').textContent = '无路可走！';
            document.getElementById('suggestionScore').textContent = '游戏结束';
            this.stopAutoPlay();
            return false;
        }
        
        const directions = ['左', '上', '右', '下'];
        document.getElementById('suggestion').textContent = directions[result.direction];
        document.getElementById('suggestionScore').textContent = `评估分数: ${Math.round(result.score)}`;
        
        this.highlightArrow(result.direction);
        
        // Execute the move
        const moveResult = this.move(this.grid, result.direction);
        this.grid = moveResult.grid;
        this.calculateScore();
        
        // Add a random tile (simulating the game)
        this.grid = this.addRandomTile(this.grid);
        this.updateDisplay();
        
        return true;
    }
    
    highlightArrow(direction) {
        this.clearArrows();
        const arrowIds = ['arrowLeft', 'arrowUp', 'arrowRight', 'arrowDown'];
        const arrow = document.getElementById(arrowIds[direction]);
        if (arrow) arrow.classList.add('active');
    }
    
    clearArrows() {
        document.querySelectorAll('.arrow').forEach(a => a.classList.remove('active'));
    }
    
    startAutoPlay() {
        if (this.isAutoPlaying) return;
        
        this.isAutoPlaying = true;
        document.body.classList.add('auto-playing');
        document.getElementById('autoPlayBtn').textContent = '停止自动';
        
        this.autoPlayInterval = setInterval(() => {
            const moved = this.aiStep();
            if (!moved || this.getAvailableMoves(this.grid).length === 0) {
                this.stopAutoPlay();
                document.getElementById('suggestion').textContent = '自动结束';
            }
        }, 300);
    }
    
    stopAutoPlay() {
        this.isAutoPlaying = false;
        document.body.classList.remove('auto-playing');
        document.getElementById('autoPlayBtn').textContent = '自动运行';
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    toggleAutoPlay() {
        if (this.isAutoPlaying) {
            this.stopAutoPlay();
        } else {
            this.startAutoPlay();
        }
    }
    
    // ==================== Event Handlers ====================
    
    bindEvents() {
        // Mode buttons
        document.getElementById('manualMode').addEventListener('click', () => {
            this.mode = 'manual';
            document.getElementById('manualMode').classList.add('active');
            document.getElementById('aiMode').classList.remove('active');
        });
        
        document.getElementById('aiMode').addEventListener('click', () => {
            this.mode = 'ai';
            document.getElementById('aiMode').classList.add('active');
            document.getElementById('manualMode').classList.remove('active');
        });
        
        // Action buttons
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('aiStepBtn').addEventListener('click', () => this.aiStep());
        document.getElementById('autoPlayBtn').addEventListener('click', () => this.toggleAutoPlay());
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.mode !== 'manual') return;
            
            const keyMap = {
                'ArrowLeft': 0,
                'ArrowUp': 1,
                'ArrowRight': 2,
                'ArrowDown': 3
            };
            
            if (keyMap[e.key] !== undefined) {
                e.preventDefault();
                const dir = keyMap[e.key];
                const result = this.move(this.grid, dir);
                if (result.moved) {
                    this.grid = result.grid;
                    this.grid = this.addRandomTile(this.grid);
                    this.updateDisplay();
                    this.calculateScore();
                    this.highlightArrow(dir);
                }
            }
        });
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game2048();
});
