export type EditorAction =
  | "new-post"
  | "edit-current-post"
  | "edit-current-project"
  | "edit-about"
  | "edit-contact"
  | "edit-profile"
  | "edit-skills"
  | "upload-image"
  | "logout";

export type StatusTone = "info" | "success" | "error";

export interface FieldDefinition {
  name: string;
  label: string;
  type: "text" | "date" | "textarea" | "checkbox" | "file";
  value?: string;
  checked?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  accept?: string;
  code?: boolean;
  autocomplete?: string;
  spellcheck?: boolean;
}

function requireElement<T extends HTMLElement>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`소유자 편집 UI 요소를 찾을 수 없습니다: ${selector}`);
  }
  return element;
}

function isEditorAction(value: string | undefined): value is EditorAction {
  return [
    "new-post",
    "edit-current-post",
    "edit-current-project",
    "edit-about",
    "edit-contact",
    "edit-profile",
    "edit-skills",
    "upload-image",
    "logout",
  ].includes(value || "");
}

export class OwnerEditorUI {
  readonly root: HTMLElement;
  private readonly login: HTMLElement;
  private readonly toolbar: HTMLElement;
  private readonly toolbarActions: HTMLElement;
  private readonly status: HTMLElement;
  private readonly panel: HTMLDialogElement;
  private readonly panelStatus: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly panelTitle: HTMLElement;
  private readonly fields: HTMLElement;
  private readonly toastElement: HTMLElement;
  private toastTimer = 0;
  private panelReturnFocus: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.login = requireElement("#owner-editor-login", HTMLElement);
    this.toolbar = requireElement("#owner-editor-toolbar", HTMLElement);
    const toolbarActions = this.toolbar.querySelector(".owner-editor-toolbar-actions");
    if (!(toolbarActions instanceof HTMLElement)) {
      throw new Error("소유자 편집 도구의 작업 버튼 영역을 찾을 수 없습니다.");
    }
    this.toolbarActions = toolbarActions;
    this.status = requireElement("#owner-editor-status", HTMLElement);
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.panel = requireElement("dialog#owner-editor-panel", HTMLDialogElement);
    this.panelStatus = requireElement("#owner-editor-panel-status", HTMLElement);
    this.form = requireElement("#owner-editor-form", HTMLFormElement);
    this.panelTitle = requireElement("#owner-editor-panel-title", HTMLElement);
    this.fields = requireElement("#owner-editor-fields", HTMLElement);
    this.toastElement = requireElement("#owner-editor-toast", HTMLElement);

    document.querySelectorAll<HTMLElement>("[data-editor-close]").forEach((button) => {
      button.addEventListener("click", () => this.closePanel());
    });
    this.panel.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.closePanel();
    });
  }

  activate(): void {
    this.root.hidden = false;
    this.root.setAttribute("aria-hidden", "false");
  }

  onLogin(handler: () => void | Promise<void>): void {
    this.login.addEventListener("click", () => void handler());
  }

  onAction(handler: (action: EditorAction) => void | Promise<void>): void {
    this.toolbar.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-editor-action]") : null;
      const action = target?.dataset.editorAction;
      if (isEditorAction(action)) void handler(action);
    });
  }

  onSubmit(handler: (formData: FormData) => void | Promise<void>): void {
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!this.form.reportValidity()) return;
      void handler(new FormData(this.form));
    });
  }

  configureActions(pageKind: string, pagePath: string): void {
    this.toolbar.querySelectorAll<HTMLElement>("[data-editor-action]").forEach((element) => {
      const action = element.dataset.editorAction;
      if (action === "edit-current-post") element.hidden = pageKind !== "post" || !pagePath;
      if (action === "edit-current-project") element.hidden = pageKind !== "project" || !pagePath;
    });
  }

  showChecking(): void {
    this.login.hidden = true;
    this.toolbar.hidden = false;
    this.toolbarActions.hidden = true;
    this.setStatus("편집 세션을 확인하고 있습니다.", "info");
  }

  showLoggedOut(message = ""): void {
    this.login.hidden = false;
    this.toolbar.hidden = !message;
    this.toolbarActions.hidden = true;
    this.setStatus(message, "info");
  }

  showAuthenticated(login: string): void {
    this.login.hidden = true;
    this.toolbar.hidden = false;
    this.toolbarActions.hidden = false;
    this.setStatus(login ? `${login} 계정으로 편집 세션이 활성화되었습니다.` : "편집 세션이 활성화되었습니다.", "success");
  }

  setStatus(message: string, tone: StatusTone = "info"): void {
    this.status.replaceChildren(document.createTextNode(message));
    this.status.dataset.tone = tone;
    this.status.hidden = !message;
    if (this.panel.open) {
      this.panelStatus.replaceChildren(document.createTextNode(message));
      this.panelStatus.dataset.tone = tone;
      this.panelStatus.hidden = !message;
    }
  }

  showCommitResult(message: string, sha: string, url: string): void {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode(`${message} `));

    if (sha) {
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `커밋 ${sha.slice(0, 8)}`;
        fragment.append(link);
      } else {
        fragment.append(document.createTextNode(`커밋 ${sha.slice(0, 8)}`));
      }
      fragment.append(document.createTextNode(" · "));
    }

    fragment.append(document.createTextNode("GitHub Pages 배포가 완료될 때까지 잠시 기다려 주세요."));
    this.status.replaceChildren(fragment);
    this.status.dataset.tone = "success";
    this.status.hidden = false;
  }

  showMediaResult(markdown: string, copied: boolean, sha: string, url: string): void {
    const fragment = document.createDocumentFragment();
    fragment.append(
      document.createTextNode(
        copied ? "이미지를 업로드하고 Markdown 경로를 클립보드에 복사했습니다." : "이미지를 업로드했습니다. 아래 Markdown 경로를 복사하세요.",
      ),
    );
    const code = document.createElement("code");
    code.textContent = markdown;
    fragment.append(code);
    if (sha) {
      fragment.append(document.createTextNode(" "));
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `커밋 ${sha.slice(0, 8)}`;
        fragment.append(link);
      } else {
        fragment.append(document.createTextNode(`커밋 ${sha.slice(0, 8)}`));
      }
    }
    fragment.append(document.createTextNode(" GitHub Pages 배포가 완료될 때까지 잠시 기다려 주세요."));
    this.status.replaceChildren(fragment);
    this.status.dataset.tone = "success";
    this.status.hidden = false;
  }

  toast(message: string): void {
    window.clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      this.toastElement.hidden = true;
    }, 4_000);
  }

  openPanel(title: string, definitions: FieldDefinition[], submitLabel: string): void {
    if (!this.panel.open) {
      this.panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    document.dispatchEvent(
      new CustomEvent("daeho:dialog-opening", {
        detail: { dialog: this.panel, trigger: this.panelReturnFocus },
      }),
    );
    this.form.reset();
    this.panelStatus.hidden = true;
    this.panelStatus.textContent = "";
    this.panelTitle.textContent = title;
    this.fields.replaceChildren(...definitions.map((definition) => this.createField(definition)));

    const submit = this.form.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
    if (submit instanceof HTMLButtonElement) submit.textContent = submitLabel;
    if (submit instanceof HTMLInputElement) submit.value = submitLabel;

    if (this.panel.open) this.panel.close();
    if (typeof this.panel.showModal === "function") this.panel.showModal();
    else this.panel.setAttribute("open", "");
    document.body.classList.add("owner-editor-dialog-open");

    window.requestAnimationFrame(() => {
      this.fields.querySelector<HTMLElement>("input, textarea, button")?.focus();
    });
  }

  closePanel(): void {
    const returnFocus = this.panelReturnFocus;
    this.panelReturnFocus = null;
    if (this.panel.open && typeof this.panel.close === "function") this.panel.close();
    else this.panel.removeAttribute("open");
    document.body.classList.remove("owner-editor-dialog-open");
    this.fields.replaceChildren();
    this.panelStatus.hidden = true;
    this.panelStatus.textContent = "";
    if (returnFocus && document.contains(returnFocus)) {
      window.requestAnimationFrame(() => returnFocus.focus());
    }
  }

  setBusy(busy: boolean): void {
    this.form.setAttribute("aria-busy", String(busy));
    this.form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>("input, textarea, button").forEach((element) => {
      element.disabled = busy;
    });
  }

  private createField(definition: FieldDefinition): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "owner-editor-field";

    if (definition.type === "checkbox") {
      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "owner-editor-field-label owner-editor-checkbox";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "owner-editor-checkbox-control";
      input.name = definition.name;
      input.checked = Boolean(definition.checked);
      const text = document.createElement("span");
      text.textContent = definition.label;
      checkboxLabel.append(input, text);
      wrapper.append(checkboxLabel);
      if (definition.hint) wrapper.append(this.createHint(definition.hint));
      return wrapper;
    }

    const id = `owner-editor-field-${definition.name}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = definition.label;
    wrapper.append(label);

    let control: HTMLInputElement | HTMLTextAreaElement;
    if (definition.type === "textarea") {
      const textarea = document.createElement("textarea");
      textarea.rows = definition.rows || 8;
      textarea.value = definition.value || "";
      textarea.spellcheck = definition.spellcheck ?? !definition.code;
      if (definition.code) textarea.classList.add("owner-editor-code");
      if (definition.name === "body") textarea.dataset.editorBody = "";
      control = textarea;
    } else {
      const input = document.createElement("input");
      input.type = definition.type;
      input.value = definition.value || "";
      if (definition.accept) input.accept = definition.accept;
      if (definition.autocomplete) input.setAttribute("autocomplete", definition.autocomplete);
      control = input;
    }

    control.id = id;
    control.name = definition.name;
    control.required = Boolean(definition.required);
    if (definition.placeholder) control.placeholder = definition.placeholder;
    wrapper.append(control);
    if (definition.hint) wrapper.append(this.createHint(definition.hint));
    return wrapper;
  }

  private createHint(text: string): HTMLElement {
    const hint = document.createElement("p");
    hint.className = "owner-editor-field-help";
    hint.textContent = text;
    return hint;
  }
}
