document.addEventListener('DOMContentLoaded', () => {
    const dayInput = document.getElementById('day-input');
    const depthInput = document.getElementById('depth-input');
    const showHiddenInput = document.getElementById('show-hidden-input');
    const ghostCanvasInput = document.getElementById('ghost-canvas-input');
    const showDetailsInput = document.getElementById('show-details-input');
    const generateBtn = document.getElementById('generate-btn');
    const errorEl = document.getElementById('error');
    const statsEl = document.getElementById('stats');
    const statVoxels = document.getElementById('stat-voxels');
    
    // New UI Elements
    const actionsDiv = document.getElementById('actions');
    const downloadBtn = document.getElementById('download-btn');
    const toggleUiBtn = document.getElementById('toggle-ui-btn');
    const controlsDiv = document.querySelector('.controls');
    const tooltip = document.getElementById('tooltip');
    
    // Feature UI
    const postGenerateControls = document.getElementById('post-generate-controls');
    const heatmapModeInput = document.getElementById('heatmap-mode-input');
    const heatmapStyleSelect = document.getElementById('heatmap-style-select');
    const heatmapOptions = document.getElementById('heatmap-options');
    const timeLapseInput = document.getElementById('time-lapse-input');
    
    const PLAY_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Play';
    const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>Pause';

    // Animation UI
    const animationControls = document.getElementById('animation-controls');
    const animSlider = document.getElementById('anim-slider');
    const animPlayBtn = document.getElementById('anim-play-btn');
    const animSpeedSelect = document.getElementById('anim-speed-select');
    
    // Three.js Globals
    let scene, camera, renderer, controls;
    let controller1, controller2;
    let voxelGroup;
    let needsRender = true;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let authorCounts = {};
    let selectedHeatmapAuthor = null;
    let lastClickTime = 0;
    // Animation Globals
    let isPlayingAnim = false;
    let playbackTime = 0;
    let animSpeed = 20;
    


    // Custom Select Initialization
    function initCustomSelects() {
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            select.style.display = 'none';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            if (select.classList.contains('dropup')) {
                wrapper.classList.add('dropup');
            }
            select.parentNode.insertBefore(wrapper, select);
            wrapper.appendChild(select);
            
            const customSelect = document.createElement('div');
            customSelect.className = 'custom-select';
            
            const selectedText = document.createElement('span');
            selectedText.textContent = select.options[select.selectedIndex].text;
            customSelect.appendChild(selectedText);
            
            const arrow = document.createElement('span');
            arrow.className = 'custom-select-arrow';
            customSelect.appendChild(arrow);
            
            const customOptions = document.createElement('div');
            customOptions.className = 'custom-options';
            
            Array.from(select.options).forEach((option, index) => {
                const customOpt = document.createElement('div');
                customOpt.className = 'custom-option';
                if (index === select.selectedIndex) customOpt.classList.add('selected');
                customOpt.textContent = option.text;
                
                customOpt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.selectedIndex = index;
                    selectedText.textContent = option.text;
                    
                    Array.from(customOptions.children).forEach(c => c.classList.remove('selected'));
                    customOpt.classList.add('selected');
                    
                    customSelect.classList.remove('open');
                    customOptions.classList.remove('open');
                    
                    // Dispatch change event to trigger existing app logic
                    select.dispatchEvent(new Event('change'));
                });
                customOptions.appendChild(customOpt);
            });
            
            wrapper.appendChild(customSelect);
            wrapper.appendChild(customOptions);
            
            customSelect.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all others first
                document.querySelectorAll('.custom-select.open').forEach(el => {
                    if (el !== customSelect) {
                        el.classList.remove('open');
                        el.nextElementSibling.classList.remove('open');
                    }
                });
                customSelect.classList.toggle('open');
                customOptions.classList.toggle('open');
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select.open').forEach(el => {
                el.classList.remove('open');
                el.nextElementSibling.classList.remove('open');
            });
        });
    }

    initCustomSelects();
    initThreeJS();

    generateBtn.addEventListener('click', () => {
        generate3D();
    });
    
    depthInput.addEventListener('input', updateTransforms);
    showHiddenInput.addEventListener('change', updateDepth);
    ghostCanvasInput.addEventListener('change', (e) => {
        if (window.ghostPlane) {
            window.ghostPlane.visible = e.target.checked;
            needsRender = true;
        }
    });
    
    heatmapModeInput.addEventListener('change', (e) => {
        heatmapOptions.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) selectedHeatmapAuthor = null;
        if (heatmapStyleSelect.value === 'glass') {
            renderInstancedMeshes();
        } else {
            updateTransforms();
        }
    });

    timeLapseInput.addEventListener('change', (e) => {
        if (e.target.checked) {
            animationControls.style.display = 'flex';
        } else {
            animationControls.style.display = 'none';
            isPlayingAnim = false;
            animPlayBtn.innerHTML = PLAY_ICON;
            if (window.voxelData) {
                playbackTime = window.voxelData.maxZ;
                updateAnimationState();
            }
        }
    });

    // Animation Listeners
    animSlider.addEventListener('input', (e) => {
        playbackTime = parseInt(e.target.value, 10);
        updateAnimationState();
    });
    animSpeedSelect.addEventListener('change', (e) => {
        animSpeed = parseInt(e.target.value, 10);
    });
    animPlayBtn.addEventListener('click', () => {
        isPlayingAnim = !isPlayingAnim;
        if (isPlayingAnim && playbackTime >= window.voxelData.maxZ) {
            playbackTime = 0; // restart if at the end
        }
        animPlayBtn.innerHTML = isPlayingAnim ? PAUSE_ICON : PLAY_ICON;
    });
    
    heatmapStyleSelect.addEventListener('change', (e) => {
        // If toggling into or out of glass mode, we must completely rebuild the 3D meshes
        if (e.target.value === 'glass' || window.lastHeatmapStyle === 'glass') {
            renderInstancedMeshes();
        } else {
            updateTransforms();
        }
        window.lastHeatmapStyle = e.target.value;
    });
    
    toggleUiBtn.addEventListener('click', () => {
        const uiOverlay = document.getElementById('ui-overlay');
        uiOverlay.classList.toggle('minimized');
    });

    const hiddenArtInfo = document.getElementById('hidden-art-info');
    const infoModal = document.getElementById('info-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    if (hiddenArtInfo && infoModal && closeModalBtn) {
        hiddenArtInfo.addEventListener('click', () => {
            infoModal.style.display = 'flex';
            // Trigger reflow for fade in
            void infoModal.offsetWidth;
            infoModal.style.opacity = '1';
        });
        
        const closeModal = () => {
            infoModal.style.opacity = '0';
            setTimeout(() => {
                infoModal.style.display = 'none';
            }, 300);
        };
        
        closeModalBtn.addEventListener('click', closeModal);
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) closeModal();
        });
    }
    
    downloadBtn.addEventListener('click', () => {
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `basepaint_day${dayInput.value.trim()}_3D.png`;
        a.click();
    });

    function initThreeJS() {
        const container = document.getElementById('canvas-container');
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827); // Dark grayish blue
        scene.fog = new THREE.FogExp2(0x111827, 0.002);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 0, 400);

        // preserveDrawingBuffer is required to export toDataURL
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 800;
        controls.zoomSpeed = 1.25;
        controls.rotateSpeed = 1.5;
        controls.addEventListener('change', () => { needsRender = true; });

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(200, 500, 300);
        scene.add(dirLight);
        
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        dirLight2.position.set(-200, -100, -300);
        scene.add(dirLight2);

        voxelGroup = new THREE.Group();
        scene.add(voxelGroup);


        const highlightGeo = new THREE.BoxGeometry(1, 1, 1);
        const highlightMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.5, 
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
        highlightMesh.visible = false;
        scene.add(highlightMesh);

        window.addEventListener('resize', onWindowResize, false);
        
        let isTooltipFixed = false;
        let fixedPixelInfo = null;

        // Raycaster for hover tooltips
        const handlePointer = (event) => {
            if (isTooltipFixed) return;
            
            if (controlsDiv.contains(event.target) || event.target.closest('#download-btn') || event.target.closest('#toggle-ui-btn')) {
                if (highlightMesh.visible) {
                    highlightMesh.visible = false;
                    needsRender = true;
                }
                tooltip.classList.add('hidden');
                document.body.style.cursor = 'default';
                return;
            }
            
            if (!showDetailsInput.checked) {
                if (highlightMesh.visible) {
                    highlightMesh.visible = false;
                    needsRender = true;
                }
                tooltip.classList.add('hidden');
                document.body.style.cursor = 'default';
                return;
            }
            
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            const intersects = raycaster.intersectObjects(voxelGroup.children);
            if (intersects.length > 0) {
                const intersect = intersects[0];
                if (intersect.object.userData && intersect.object.userData.pixelData && intersect.instanceId !== undefined) {
                    const pixel = intersect.object.userData.pixelData[intersect.instanceId];
                    if (pixel && pixel.author) {
                        const matrix = new THREE.Matrix4();
                        intersect.object.getMatrixAt(intersect.instanceId, matrix);
                        highlightMesh.position.setFromMatrixPosition(matrix);
                        highlightMesh.scale.setFromMatrixScale(matrix);
                        highlightMesh.rotation.setFromRotationMatrix(matrix);
                        highlightMesh.visible = true;
                        
                        let strokeDetails = '';
                        if (pixel.stroke) {
                            const s = pixel.stroke;
                            const brushStr = s.brushId ? `#${s.brushId}` : 'N/A';
                            const sizeStr = s.pixels ? `${s.pixels} pixels` : 'N/A';
                            const ts = s.timestamp ? new Date(parseInt(s.timestamp, 10) * 1000) : null;
                            const dateOnly = ts ? ts.toLocaleDateString() : 'N/A';
                            const timeOnly = ts ? ts.toLocaleTimeString() : 'N/A';
                            const txStr = s.tx ? `<a href="https://basescan.org/tx/${s.tx}" target="_blank" style="color: #4da6ff; text-decoration: underline; pointer-events: auto;">${s.tx.slice(0, 10)}...</a>` : 'N/A';
                            
                            strokeDetails = `
                                <div style="margin-top: 3px; color: #ddd; font-size: 0.70rem;">on <strong>${dateOnly}</strong> at <strong>${timeOnly}</strong></div>
                                <div style="margin-top: 6px; margin-bottom: 6px; padding-top: 6px; padding-bottom: 6px; border-top: 1px solid rgba(255,255,255,0.2); border-bottom: 1px solid rgba(255,255,255,0.2); font-size: 0.75rem; color: #ddd; line-height: 1.4;">
                                    <div><strong>Brush:</strong> ${brushStr}</div>
                                    <div><strong>Size:</strong> ${sizeStr}</div>
                                    <div><strong>Tx:</strong> ${txStr}</div>
                                </div>
                            `;
                        }
                        
                        const actionText = showDetailsInput.checked 
                            ? 'Click to lock the card' 
                            : (heatmapModeInput.checked ? 'Double-click to view artist profile' : 'Click to view artist activity');
                        
                        tooltip.innerHTML = `by <strong>${pixel.author.slice(0,6)}...${pixel.author.slice(-4)}</strong>${strokeDetails}<span style="font-size: 0.75rem; color: #aaa; margin-top: 5px; display: block;">${actionText}</span>`;
                        tooltip.style.left = event.clientX + 15 + 'px';
                        tooltip.style.top = event.clientY + 15 + 'px';
                        tooltip.classList.remove('hidden');
                        document.body.style.cursor = 'pointer';
                        needsRender = true;
                        return;
                    }
                }
            }
            if (highlightMesh.visible) {
                highlightMesh.visible = false;
                needsRender = true;
            }
            tooltip.classList.add('hidden');
            document.body.style.cursor = 'default';
        };
        window.addEventListener('pointermove', handlePointer);
        window.addEventListener('pointerdown', handlePointer);

        // Raycaster for clicking to open profile
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        renderer.domElement.addEventListener('pointerdown', (event) => {
            startX = event.clientX;
            startY = event.clientY;
            startTime = performance.now();
        });

        renderer.domElement.addEventListener('pointerup', (event) => {
            if (controlsDiv.contains(event.target)) return;
            
            const diffX = Math.abs(event.clientX - startX);
            const diffY = Math.abs(event.clientY - startY);
            const diffTime = performance.now() - startTime;
            
            // Ignore if the mouse moved more than 3 pixels OR was held down for more than 250ms (a drag/rotate)
            if (diffX > 3 || diffY > 3 || diffTime > 250) return; 
            
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            const intersects = raycaster.intersectObjects(voxelGroup.children);
            if (intersects.length > 0) {
                const intersect = intersects[0];
                if (intersect.object.userData && intersect.object.userData.pixelData && intersect.instanceId !== undefined) {
                    const pixel = intersect.object.userData.pixelData[intersect.instanceId];
                    if (pixel && pixel.author) {
                        if (showDetailsInput.checked) {
                            if (isTooltipFixed) {
                                if (fixedPixelInfo === pixel) {
                                    setTimeout(() => window.open(`https://basepaint.xyz/@${pixel.author}`, '_blank'), 0);
                                }
                                isTooltipFixed = false;
                                fixedPixelInfo = null;
                                tooltip.style.pointerEvents = 'none';
                                tooltip.classList.add('hidden');
                                if (highlightMesh.visible) {
                                    highlightMesh.visible = false;
                                    needsRender = true;
                                }
                            } else {
                                isTooltipFixed = true;
                                fixedPixelInfo = pixel;
                                tooltip.style.pointerEvents = 'auto';
                                tooltip.innerHTML = tooltip.innerHTML.replace('Click to lock the card', 'Click again for profile');
                            }
                        } else {
                            const now = performance.now();
                            const isDoubleClick = (now - lastClickTime < 300);
                            if (heatmapModeInput.checked) {
                                if (isDoubleClick) {
                                    setTimeout(() => window.open(`https://basepaint.xyz/@${pixel.author}`, '_blank'), 0);
                                }
                            } else {
                                setTimeout(() => window.open(`https://basepaint.xyz/@${pixel.author}`, '_blank'), 0);
                            }
                            lastClickTime = now;
                        }

                        if (heatmapModeInput.checked) {
                            if (!showDetailsInput.checked || isTooltipFixed) {
                                selectedHeatmapAuthor = pixel.author;
                                if (heatmapStyleSelect.value === 'glass') {
                                    renderInstancedMeshes();
                                } else {
                                    updateTransforms();
                                }
                            }
                        }
                    }
                }
            } else {
                if (isTooltipFixed) {
                    isTooltipFixed = false;
                    fixedPixelInfo = null;
                    tooltip.style.pointerEvents = 'none';
                    tooltip.classList.add('hidden');
                    if (highlightMesh.visible) {
                        highlightMesh.visible = false;
                        needsRender = true;
                    }
                }

                if (heatmapModeInput.checked && selectedHeatmapAuthor) {
                    selectedHeatmapAuthor = null;
                    if (heatmapStyleSelect.value === 'glass') {
                        renderInstancedMeshes();
                    } else {
                        updateTransforms();
                    }
                }
            }
        });
        
        animate();
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        needsRender = true;
    }

    function animate() {
        renderer.setAnimationLoop(() => {
            const controlsChanged = controls.update();
            
            if (isPlayingAnim && window.voxelData) {
                playbackTime += animSpeed;
                if (playbackTime >= window.voxelData.maxZ) {
                    playbackTime = window.voxelData.maxZ;
                    isPlayingAnim = false;
                    animPlayBtn.innerHTML = PLAY_ICON;
                }
                updateAnimationState();
            }

            if (needsRender || controlsChanged) {
                renderer.render(scene, camera);
                needsRender = false;
            }
        });
        
        needsRender = true;
    }

    async function generate3D() {
        const dayInput = document.getElementById('day-input');
        if (!dayInput.value.trim()) {
            showError("Please enter a canvas day (e.g. 45)");
            return;
        }
        const dayStr = dayInput.value.trim().padStart(4, '0');
        const day = parseInt(dayStr, 10);
        
        hideError();
        showLoading(true);
        statsEl.classList.add('hidden');
        actionsDiv.classList.add('hidden');
        
        // Clear existing voxels
        while(voxelGroup.children.length > 0){ 
            const child = voxelGroup.children[0];
            voxelGroup.remove(child); 
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        try {
            const themeRes = await fetch(`https://basepaint.xyz/api/theme/${day}`);
            if (!themeRes.ok) throw new Error("Failed to fetch theme.");
            const themeData = await themeRes.json();
            const palette = themeData.palette || [];
            const canvasSize = themeData.size || (day <= 365 ? 144 : 256);
            window.lastCanvasSize = canvasSize;

            camera.position.set(0, 0, canvasSize * 1.5);
            controls.target.set(0, 0, 0);

            // Fetch all Strokes with Pagination
            let strokes = [];
            let hasNextPage = true;
            let cursor = null;

            while (hasNextPage) {
                const query = `
                query GetAllStrokes($day: Int!, $cursor: String) {
                    strokes(where: { canvasId: $day }, limit: 1000, after: $cursor) {
                        items { data accountId brushId pixels timestamp tx }
                        pageInfo { hasNextPage endCursor }
                    }
                }`;
                
                const gqlRes = await fetch('https://graphql.basepaint.xyz/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query,
                        variables: { day, cursor }
                    })
                });
                
                const gqlData = await gqlRes.json();
                
                if (gqlData.data && gqlData.data.strokes) {
                     if (gqlData.data.strokes.items) {
                         strokes = strokes.concat(gqlData.data.strokes.items);
                     }
                     const pageInfo = gqlData.data.strokes.pageInfo;
                     if (pageInfo && pageInfo.hasNextPage) {
                         cursor = pageInfo.endCursor;
                     } else {
                         hasNextPage = false;
                     }
                } else {
                     hasNextPage = false;
                }
            }
            
            if (!strokes || strokes.length === 0) {
                throw new Error("No strokes found for this day.");
            }

            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const colorBuckets = {}; 
            const allPositions = [];

            palette.forEach((hex, i) => {
                colorBuckets[i] = [];
            });

            let pixelCount = 0;
            
            strokes.forEach(stroke => {
                const data = stroke.data;
                if (!data || !data.startsWith('0x')) return;
                
                const author = stroke.accountId ? stroke.accountId.toLowerCase() : "";
                
                const hex = data.slice(2);
                for (let i = 0; i < hex.length; i += 6) {
                    const chunk = hex.slice(i, i + 6);
                    if (chunk.length < 6) break;
                    
                    const x = parseInt(chunk.slice(0, 2), 16);
                    const y = parseInt(chunk.slice(2, 4), 16); 
                    const colorIndex = parseInt(chunk.slice(4, 6), 16);
                    
                    const isHidden = (x >= canvasSize || y >= canvasSize);
                    
                    if (colorIndex < palette.length) {
                        // The plane is centered at 0,0, spanning from -canvasSize/2 to canvasSize/2.
                        // x goes from 0 to canvasSize. We subtract canvasSize/2 to center it.
                        // For y, the original 2D canvas has y=0 at the top. 
                        // In 3D, y=0 is the center. 
                        const centerX = x - (canvasSize / 2) + 0.5;
                        const centerY = (canvasSize / 2) - y - 0.5;
                        
                        const p = { 
                            x: centerX, 
                            y: centerY, 
                            z: pixelCount, 
                            colorIndex, 
                            isHidden, 
                            author,
                            stroke: {
                                author: author,
                                brushId: stroke.brushId,
                                pixels: stroke.pixels,
                                timestamp: stroke.timestamp,
                                tx: stroke.tx
                            }
                        };
                        colorBuckets[colorIndex].push(p);
                        allPositions.push(p);
                        pixelCount++;
                    }
                }
            });

            // Build author counts for heatmap
            authorCounts = {};
            let maxAuthorCount = 1;
            allPositions.forEach(p => {
                if (p.author) {
                    const count = (authorCounts[p.author] || 0) + 1;
                    authorCounts[p.author] = count;
                    if (count > maxAuthorCount) maxAuthorCount = count;
                }
            });

            const maxZ = pixelCount > 0 ? pixelCount : 1;
            
            window.voxelData = {
                buckets: colorBuckets,
                allPositions: allPositions,
                maxZ: maxZ,
                palette: palette,
                meshes: [],
                canvasSize: canvasSize,
                maxAuthorCount: maxAuthorCount
            };

            // Ensure controls orbit around the origin where the art is now centered
            controls.target.set(0, 0, 0);
            controls.update();

            // Initialize Animation Slider
            animSlider.max = maxZ;
            animSlider.value = maxZ;
            playbackTime = maxZ;
            isPlayingAnim = false;
            animPlayBtn.innerHTML = PLAY_ICON;

            renderInstancedMeshes();
            
            // Ghost Canvas Base Plane
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(`https://basepaint.net/v3/${dayStr}.png`, (texture) => {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                const planeGeo = new THREE.PlaneGeometry(canvasSize, canvasSize);
                const planeMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                const plane = new THREE.Mesh(planeGeo, planeMat);
                // Place it slightly behind the earliest pixels
                plane.position.set(0, 0, -5);
                plane.visible = ghostCanvasInput.checked;
                voxelGroup.add(plane);
                window.ghostPlane = plane;
                needsRender = true;
            });
            
            statVoxels.textContent = pixelCount;
            
            showLoading(false);
            postGenerateControls.classList.remove('hidden');
            actionsDiv.classList.remove('hidden');
            statsEl.classList.remove('hidden');
            document.getElementById('top-left-controls').classList.remove('hidden');

        } catch (err) {
            console.error(err);
            showLoading(false);
            showError(err.message || "An error occurred fetching 3D data.");
        }
    }

    function renderInstancedMeshes() {
        if (!window.voxelData) return;
        
        window.voxelData.meshes.forEach(m => voxelGroup.remove(m));
        window.voxelData.meshes = [];
        
        const { buckets, maxZ, palette, canvasSize } = window.voxelData;
        const depthMultiplier = parseInt(depthInput.value, 10);
        const showHidden = showHiddenInput.checked;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        const isGlassMode = heatmapModeInput.checked && heatmapStyleSelect.value === 'glass' && selectedHeatmapAuthor;
        
        const dummy = new THREE.Object3D();

        Object.keys(buckets).forEach(colorIdx => {
            const positions = buckets[colorIdx];
            const visiblePositions = positions.filter(p => showHidden || !p.isHidden);
            if (visiblePositions.length === 0) return;
            
            const colorHex = parseInt(palette[colorIdx].replace('#', '0x'), 16);
            const baseColor = new THREE.Color(colorHex);
            
            if (isGlassMode) {
                const activePos = visiblePositions.filter(p => p.author === selectedHeatmapAuthor);
                const inactivePos = visiblePositions.filter(p => p.author !== selectedHeatmapAuthor);
                
                if (activePos.length > 0) {
                    const matActive = new THREE.MeshLambertMaterial({ color: 0xffffff });
                    const meshActive = new THREE.InstancedMesh(geometry, matActive, activePos.length);
                    meshActive.userData.pixelData = activePos;
                    activePos.forEach((pos, i) => {
                        const scaledZ = (pos.z / maxZ) * depthMultiplier;
                        dummy.position.set(pos.x, pos.y, scaledZ);
                        dummy.updateMatrix();
                        meshActive.setMatrixAt(i, dummy.matrix);
                        meshActive.setColorAt(i, baseColor);
                    });
                    voxelGroup.add(meshActive);
                    window.voxelData.meshes.push(meshActive);
                }
                
                if (inactivePos.length > 0) {
                    const matInactive = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
                    const meshInactive = new THREE.InstancedMesh(geometry, matInactive, inactivePos.length);
                    meshInactive.userData.pixelData = inactivePos;
                    inactivePos.forEach((pos, i) => {
                        const scaledZ = (pos.z / maxZ) * depthMultiplier;
                        dummy.position.set(pos.x, pos.y, scaledZ);
                        dummy.updateMatrix();
                        meshInactive.setMatrixAt(i, dummy.matrix);
                        meshInactive.setColorAt(i, baseColor);
                    });
                    voxelGroup.add(meshInactive);
                    window.voxelData.meshes.push(meshInactive);
                }
            } else {
                const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
                const mesh = new THREE.InstancedMesh(geometry, material, visiblePositions.length);
                mesh.userData.pixelData = visiblePositions;
                
                visiblePositions.forEach((pos, i) => {
                    const scaledZ = (pos.z / maxZ) * depthMultiplier;
                    dummy.position.set(pos.x, pos.y, scaledZ);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                    mesh.setColorAt(i, baseColor);
                });
                
                voxelGroup.add(mesh);
                window.voxelData.meshes.push(mesh);
            }
        });
        
        updateAnimationState();
    }

    function updateDepth() {
        renderInstancedMeshes();
    }

    function updateAnimationState() {
        if (!window.voxelData) return;
        
        animSlider.value = playbackTime;
        
        if (timeLapseInput.checked) {
            statVoxels.textContent = `${Math.floor(playbackTime)} / ${window.voxelData.maxZ}`;
        } else {
            statVoxels.textContent = window.voxelData.maxZ;
        }
        
        window.voxelData.meshes.forEach(mesh => {
            if (!mesh.userData || !mesh.userData.pixelData) return;
            const data = mesh.userData.pixelData;
            
            // Binary search to find how many pixels in this mesh have z <= playbackTime
            let low = 0;
            let high = data.length - 1;
            let count = 0;
            
            while (low <= high) {
                let mid = Math.floor((low + high) / 2);
                if (data[mid].z <= playbackTime) {
                    count = mid + 1;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            
            mesh.count = count;
        });
        
        needsRender = true;
    }

    function updateTransforms() {
        if (!window.voxelData) return;
        
        const { maxZ, palette } = window.voxelData;
        const depthMultiplier = parseInt(depthInput.value, 10);
        
        const isHeatmap = heatmapModeInput.checked;
        const isShrink = isHeatmap && heatmapStyleSelect.value === 'shrink';

        const depthChanged = window.lastDepthMultiplier !== depthMultiplier;
        window.lastDepthMultiplier = depthMultiplier;

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        window.voxelData.meshes.forEach(mesh => {
            if (!mesh.isInstancedMesh) return;
            
            const positions = mesh.userData.pixelData;
            let meshNeedsColorUpdate = isHeatmap || mesh.userData.wasHeatmap;
            mesh.userData.wasHeatmap = isHeatmap;
            
            let needsMatrixUpdate = isShrink || mesh.userData.wasShrunk || depthChanged;
            mesh.userData.wasShrunk = isShrink;
            
            let colorUpdated = false;

            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                
                if (needsMatrixUpdate) {
                    let heatmapScale = 1.0;
                    if (isHeatmap && selectedHeatmapAuthor && pos.author !== selectedHeatmapAuthor && isShrink) {
                        heatmapScale = 0.15;
                    }
                    
                    let scaledZ = (pos.z / maxZ) * depthMultiplier;
                    
                    dummy.matrix.set(
                        heatmapScale, 0, 0, pos.x,
                        0, heatmapScale, 0, pos.y,
                        0, 0, heatmapScale, scaledZ,
                        0, 0, 0, 1
                    );
                    mesh.setMatrixAt(i, dummy.matrix);
                }
                
                if (meshNeedsColorUpdate) {
                    const baseColorHex = parseInt(palette[pos.colorIndex].replace('#', '0x'), 16);
                    color.setHex(baseColorHex);
                    
                    if (isHeatmap && selectedHeatmapAuthor) {
                        if (pos.author !== selectedHeatmapAuthor) {
                            if (heatmapStyleSelect.value === 'flat') {
                                color.setHex(0x444444);
                            }
                        }
                    }
                    
                    mesh.setColorAt(i, color);
                    colorUpdated = true;
                }
            }
            
            if (needsMatrixUpdate) mesh.instanceMatrix.needsUpdate = true;
            if (colorUpdated) mesh.instanceColor.needsUpdate = true;
        });
        
        needsRender = true;
    }

    function showLoading(isLoading) {
        if (isLoading) {
            generateBtn.style.pointerEvents = 'none';
            generateBtn.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <div class="spinner"></div>
                    <span>Fetching blockchain data</span>
                </div>
            `;
        } else {
            generateBtn.style.pointerEvents = 'auto';
            generateBtn.textContent = 'Generate Sculpture';
        }
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }
    
    function hideError() {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
    }
});


