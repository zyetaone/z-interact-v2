export class Viewer {
	compareSlider = $state(50);
	isSidebarOpen = $state(true);
	isDragging = $state(false);
	isDraggingCompare = $state(false);
	imgRef: HTMLImageElement | undefined = $state();
	imgWidth = $state(0);
	imgHeight = $state(0);
	natWidth = $state(0);
	natHeight = $state(0);

	// Mobile state
	isMobile = $state(false);
	sheetSnap = $state<'collapsed' | 'peek' | 'full'>('peek');

	readonly canvasWidth = $derived(this.imgWidth);
	readonly canvasHeight = $derived(this.imgHeight);
	readonly naturalWidth = $derived(this.natWidth);
	readonly naturalHeight = $derived(this.natHeight);

	readonly renderedFrame = $derived.by(() => {
		if (!this.imgRef || !this.naturalWidth || !this.naturalHeight) {
			return { x: 0, y: 0, width: 0, height: 0, scale: 1 };
		}

		const containerRatio = this.canvasWidth / this.canvasHeight;
		const imageRatio = this.naturalWidth / this.naturalHeight;

		let w, h, x, y;
		if (containerRatio > imageRatio) {
			// Letterboxed on sides
			h = this.canvasHeight;
			w = h * imageRatio;
			x = (this.canvasWidth - w) / 2;
			y = 0;
		} else {
			// Letterboxed on top/bottom
			w = this.canvasWidth;
			h = w / imageRatio;
			x = 0;
			y = (this.canvasHeight - h) / 2;
		}

		return { x, y, width: w, height: h, scale: this.naturalWidth / w };
	});

	setupMediaQuery() {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(max-width: 767px)');
		this.isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			this.isMobile = e.matches;
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}

	reset() {
		this.compareSlider = 50;
		this.isSidebarOpen = true;
		this.isDragging = false;
		this.isDraggingCompare = false;
		this.imgRef = undefined;
		this.imgWidth = 0;
		this.imgHeight = 0;
		this.natWidth = 0;
		this.natHeight = 0;
		// Do NOT reset isMobile — driven by media query only
		this.sheetSnap = 'peek';
	}
}
