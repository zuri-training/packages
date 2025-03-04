import { CompilationResult, Compiler, CompilerConfigInterface } from './Compiler';
import { hooks } from './Hooks';

export interface RuntimeConfigInterface {
	dev?: boolean,
	compiler?: CompilerConfigInterface,
	repaintTimeout?: number
}

interface UpdateCssCallbackArgumentsInterface {
	css: string|null,
	compilationResult: CompilationResult,
	content: string
}

type UpdateCssCallbackType = (data: UpdateCssCallbackArgumentsInterface) => void;

export interface RuntimeHooksListInterface {
	'stylify:ready': Runtime,
	'stylify:configured': {
		config: RuntimeConfigInterface
	},
	'stylify:repainted': {
		css: string,
		compilationResult: CompilationResult,
		content: string
	},
	'stylify:uncloak': {
		el: HTMLElement
	}
}

export class Runtime {

	public static readonly styleElId: string = 'stylify-css';

	public static readonly ignoreClass = 'stylify-ignore';

	public static readonly cloakClass: string = 's-cloak';

	public dev = false;

	public compiler!: Compiler;

	public hooks = hooks;

	public compilationResult!: CompilationResult;

	private initialPaintCompleted = false;

	private mutationObserverInitialized = false;

	public repaintTimeout = 100;

	constructor(config: RuntimeConfigInterface = {}) {
		if (typeof document === 'undefined') {
			return;
		}

		this.configure(config);
		hooks.callHook('stylify:ready', this);

		if (['complete', 'loaded', 'interactive'].includes(document.readyState)) {
			this.init();
			return;
		}

		document.addEventListener('DOMContentLoaded', () => this.init() );
	}

	public configure(config: RuntimeConfigInterface): void {
		const compilerConfig = config.compiler ?? {};

		this.dev = config.dev ?? this.dev;
		this.repaintTimeout = config.repaintTimeout ?? this.repaintTimeout;

		compilerConfig.dev = compilerConfig.dev ?? this.dev;
		compilerConfig.ignoredAreas = [
			...compilerConfig.ignoredAreas ?? [],
			...[/stylify-runtime-ignore([\s\S]*?)\/stylify-runtime-ignore/]
		];

		try {
			if (!this.compiler) {
				this.compiler = new Compiler();
			}

			this.compiler.configure(compilerConfig);
		} catch (error) {
			console.error(error);
			return;
		}

		hooks.callHook('stylify:configured', {
			config: config
		});

		if (this.initialPaintCompleted) {
			this.compilationResult = null;
			this.updateCss(document.documentElement.outerHTML);
		}
	}

	private init() {
		if (!this.initialPaintCompleted) {
			const content = document.documentElement.outerHTML;
			this.updateCss(content, () => {
				this.initialPaintCompleted = true;
			});
		}

		if (!this.mutationObserverInitialized) {
			this.initMutationObserver();
		}
	}

	private updateCss(content: string, callback: UpdateCssCallbackType = null): string | undefined {
		try {
			this.compilationResult = this.compiler.compile(content, this.compilationResult);
		} catch (error) {
			console.error(error);
			return;
		}

		if (!this.compilationResult.changed && this.initialPaintCompleted) {
			return;
		}

		const css: string = this.compilationResult.generateCss();
		this.injectCss(css);

		if (callback) {
			callback({
				css: css,
				compilationResult: this.compilationResult,
				content: content
			});
		}

		hooks.callHook('stylify:repainted', {
			css: css,
			compilationResult: this.compilationResult,
			content: content
		});

		return css;
	}

	public initMutationObserver(): void {
		this.mutationObserverInitialized = true;
		const targetNode = document.documentElement;
		const config = { attributeFilter: ['class'], childList: true, subtree: true };
		let compilerContentQueue = '';
		let updateTimeout: number;
		const ignoreSelector = `.${Runtime.ignoreClass}`;

		const observer = new MutationObserver((mutationsList) => {
			mutationsList.forEach((mutation) => {
				let targetElement = mutation.target as Element;

				if (!['attributes', 'childList'].includes(mutation.type)
					|| mutation.type === 'attributes' && mutation.attributeName !== 'class'
					|| targetElement.nodeType !== Node.ELEMENT_NODE
					|| targetElement.id === Runtime.styleElId
					|| targetElement.classList.contains(Runtime.ignoreClass)
					|| targetElement.closest(ignoreSelector) !== null
				) {
					return;
				}

				targetElement = targetElement.cloneNode(true) as Element;
				targetElement.querySelectorAll(ignoreSelector).forEach((element) => {
					element.remove();
				});

				if (mutation.type === 'attributes') {
					const contentToAdd = ` class="${targetElement.className}"`;
					if (!compilerContentQueue.includes(contentToAdd)) {
						compilerContentQueue += contentToAdd;
					}
				} else if (!compilerContentQueue.includes(targetElement.outerHTML)) {
					compilerContentQueue += targetElement.outerHTML;
				}
			});

			if (updateTimeout) {
				window.clearTimeout(updateTimeout);
			}

			if (!compilerContentQueue.trim().length) {
				return;
			}

			updateTimeout = window.setTimeout(() => {
				compilerContentQueue = this.updateCss(compilerContentQueue) ?? '';
			}, this.repaintTimeout);
		});

		observer.observe(targetNode, config);
	}

	public injectCss(css: string): void {
		let el = document.querySelector(`#${Runtime.styleElId}`);

		if (el) {
			el.innerHTML = css;
		} else {
			el = document.createElement('style');
			el.id = Runtime.styleElId;
			el.innerHTML = css;
			document.head.appendChild(el);
		}

		const elements = document.querySelectorAll<HTMLElement>(`.${Runtime.cloakClass}`);
		elements.forEach((element) => {
			element.classList.remove(Runtime.cloakClass);
			hooks.callHook('stylify:uncloak', { el: element });
		});
	}

}
