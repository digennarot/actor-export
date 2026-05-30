import { semVer } from './lib/SemVer.js';
import { baseProvider } from './lib/providers/BaseProvider.js';
import './lib/FileSaver.js';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * @class
 * Class to contain all relevant information and functions for the module
 */
export class actorExport {
    static ID = 'actor-export';
    static SETTINGS = {
        ALL_PROVIDERS: 'allProviders',
        ENABLED_PROVIDERS: 'enabledProviders',
        PROVIDER_FILTER: 'exportProviderFilter',
        PROVIDER_CUSTOM: 'exportProviderCustom',
        PROVIDER_CUSTOM_CODE: 'exportProviderCustomCode',
        PROVIDER_OVERRIDE_PDF_FONTS: 'exportProviderOverridePdfFonts',
        PROVIDER_OVERRIDE_PDF_FONTS_SELECTION: 'exportProviderOverridePdfFontsSelection',
        SELECTED_PROVIDER_FILES: 'exportSelectedProviderFiles',
    };
    static TEMPLATES = {
        ACTOR_EXPORT: `modules/${this.ID}/templates/actor-export.hbs`,
        ACTOR_EXPORT_PROVIDER: `modules/${this.ID}/templates/actor-export-provider.hbs`,
        ACTOR_EXPORT_CUSTOM_PROVIDER: `modules/${this.ID}/templates/actor-export-custom-provider.hbs`,
    };

    /**
     * Generate a uniform message based on severity using console
     * @param {string} severity - The severity of the message
     * @param {string} message - The message to raised
     * @param {...any} args - additional arguments for console
     */
    static log(severity, message, ...args) {
        const msg = `${this.ID} | ${message}`;
        switch (severity) {
            case 'error':
                console.error(msg, ...args);
                break;
            case 'warn':
            case 'warning':
                console.warn(msg, ...args);
                break;
            case 'debug':
                console.debug(msg, ...args);
                break;
            default:
                console.info(msg, ...args);
        }
    }

    static partition(str, separator = ".") {
        const index = str.indexOf(separator);

        if (index === -1) {
            return [str, "", ""];
        }

        return [
            str.slice(0, index),
            separator,
            str.slice(index + separator.length)
        ];
    }

    /**
     * The initialization function for the module
     */
    static init() {
        this.log('info', 'Starting');
        game.settings.registerMenu(this.ID, this.SETTINGS.PROVIDER_FILTER, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_FILTER}.name`,
            label: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_FILTER}.label`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_FILTER}.hint`,
            icon: `fa fa-cogs`,
            type: actorExportProvidersDialogV2,
            restricted: true,
            requiresReload: true,
        });

        game.settings.registerMenu(this.ID, this.SETTINGS.PROVIDER_CUSTOM, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_CUSTOM}.name`,
            label: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_CUSTOM}.label`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_CUSTOM}.hint`,
            icon: `fa fa-file-code`,
            type: actorExportCustomProviderV2,
            restricted: true,
            requiresReload: true,
        });

        game.settings.register(this.ID, this.SETTINGS.PROVIDER_OVERRIDE_PDF_FONTS, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_OVERRIDE_PDF_FONTS}.name`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_OVERRIDE_PDF_FONTS}.hint`,
            scope: 'client',
            config: true,
            type: Boolean,
            restricted: false,
            requiresReload: false,
            default: false,
        });

        game.settings.register(this.ID, this.SETTINGS.PROVIDER_OVERRIDE_PDF_FONTS_SELECTION, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_OVERRIDE_PDF_FONTS_SELECTION}.name`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_OVERRIDE_PDF_FONTS_SELECTION}.hint`,
            scope: 'client',
            config: true,
            type: String,
            choices: {
                Courier: 'Courier',
                CourierBold: 'Courier Bold',
                CourierOblique: 'Courier Oblique',
                CourierBoldOblique: 'Courier Bold Oblique',
                Helvetica: 'Helvetica',
                HelveticaBold: 'Helvetica Bold',
                HelveticaOblique: 'Helvetica Oblique',
                HelveticaBoldOblique: 'Helvetica Bold Oblique',
                TimesRoman: 'Times Roman',
                TimesRomanBold: 'Times Roman Bold',
                TimesRomanItalic: 'Times Roman Italic',
                TimesRomanBoldItalic: 'Times Roman Bold Italic',
                Symbol: 'Symbol',
                ZapfDingbats: 'Zapf Dingbats',
            },
            restricted: false,
            requiresReload: false,
            default: 'Helvetica',
        });

        game.settings.register(this.ID, this.SETTINGS.ALL_PROVIDERS, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.ALL_PROVIDERS}.name`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.ALL_PROVIDERS}.hint`,
            scope: 'world',
            config: false,
            type: Array,
            default: [],
        });

        game.settings.register(this.ID, this.SETTINGS.PROVIDER_CUSTOM_CODE, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_CUSTOM_CODE}.name`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.PROVIDER_CUSTOM_CODE}.hint`,
            scope: 'world',
            config: false,
            type: String,
            default: '',
            restricted: true,
            requiresReload: true,
        });

        game.settings.register(this.ID, this.SETTINGS.ENABLED_PROVIDERS, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.ENABLED_PROVIDERS}.name`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.ENABLED_PROVIDERS}.hint`,
            scope: 'world',
            config: false,
            type: Array,
            default: [],
        });

        game.settings.register(this.ID, this.SETTINGS.SELECTED_PROVIDER_FILES, {
            name: `ACTOR-EXPORT.settings.${this.SETTINGS.SELECTED_PROVIDER_FILES}.name`,
            hint: `ACTOR-EXPORT.settings.${this.SETTINGS.SELECTED_PROVIDER_FILES}.hint`,
            scope: 'client',
            config: false,
            type: Array,
            default: [],
        });
    }

    /**
     * Returns an array of all providers found by the GM in ./providers
     * @returns {Array}
     */
    static async providers() {
        let providers = [];
        let ls;
        if (game.user.isGM) {
            if (parseFloat(game.version) >= 13) {
                ls = await foundry.applications.apps.FilePicker.browse('data', `modules/${this.ID}/providers`);
            } else {
                ls = await FilePicker.browse('data', `modules/${this.ID}/providers`);
            }
            for (let i = 0; i < ls.dirs.length; i++) {
                let dir = ls.dirs[i];
                let response = await fetch(`${dir}/sheet.json`);
                let json = await response.json();
                providers.push(this.evalProviderRequirements(json));
            }
            await game.settings.set(actorExport.ID, actorExport.SETTINGS.ALL_PROVIDERS, providers);
        } else {
            providers = await game.settings.get(actorExport.ID, actorExport.SETTINGS.ALL_PROVIDERS);
        }
        return providers;
    }

    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Evaluate and enrich the provider information. Returns the same object
     * with an additional property indicating if the provider is available to the current
     * game version, system version and module version(s)
     * @param {Object} provider - The provider object to evaluate
     * @returns {Object}
     */
    static evalProviderRequirements(provider) {
        const foundryvtt_version = game.version;
        const system = game.system.id;
        const system_version = game.system.version;
        const modules = game.modules.filter((f) => f.active);

        provider.allowed = false;
        if (provider.requirements.length === 0) {
            provider.allowed = true;
        }
        const allowed = [];
        provider.requirements.forEach((req) => {
            if (typeof req.foundryvtt_version !== 'undefined') {
                allowed.push(this.evalVersion(foundryvtt_version, req.foundryvtt_version, req.foundryvtt_operator));
            } else if (typeof req.system !== 'undefined' && req.system === system) {
                allowed.push(this.evalVersion(system_version, req.system_version, req.system_operator));
            } else if (typeof req.module !== 'undefined' && modules.map((m) => m.id).includes(req.module)) {
                const module = modules.filter((f) => f.id === req.module)[0];
                allowed.push(this.evalVersion(module.version, req.module_version, req.module_operator));
            } else {
                allowed.push(false);
            }
        });
        if (allowed.filter((f) => f).length === provider.requirements.length) {
            provider.allowed = true;
        }
        return provider;
    }

    /**
     * Evaluate two semantic versions based on the operator
     * @param {string} source - version to be compared with
     * @param {string} target - version to compare
     * @param {string} operator - operator
     * @returns {boolean}
     */
    static evalVersion(source, target, operator = 'gte') {
        if (typeof operator === 'string') {
            operator = operator.toLowerCase();
        }
        if (['eq', 'ne', 'gt', 'lt', 'lte'].includes(operator)) {
            return semVer[operator](source, target);
        } else {
            return semVer.gte(source, target);
        }
    }

    /**
     *
     * @param {string} provider - unique identifier for the provider
     * @returns
     */
    static providerPath(provider) {
        return foundry.utils.getRoute(`/modules/${this.ID}/providers/${provider}`);
    }

    /**
     * Return the full path to the specified path
     * @param {string} filePath - the path to the file to be parsed
     * @param {string} provider - unique identifier for the provider
     * @returns {string}
     */
    static parseFilePath(filePath, provider) {
        /* FIXME: check if the URI is complete before building it */
        return this.providerPath(provider) + `/${filePath}`;
    }

    static providerFileProgress(html) {
        const isDisabled = $(html).find('input').prop('disabled');
        if (!isDisabled) {
            html.classList.add('working');
        } else {
            html.classList.remove('working');
            document.getElementById('download_counter').value =
                parseInt(document.getElementById('download_counter').value) - 1;
        }
        $(html).find('input').prop('disabled', !isDisabled);
        if (parseInt(document.getElementById('download_counter').value) > 0) {
            document.getElementById('actor-export-download').disabled = true;
            document.getElementById('actor-export-spinner-canvas').style.display = 'flex';
        } else {
            document.getElementById('actor-export-download').disabled = false;
            document.getElementById('actor-export-spinner-canvas').style.display = 'none';
        }
    }


}

/**
 * @class
 * A form class for the Actor Export Dialog
 * @param {Object} actor the Foundry VTT actor object
 * @param {Object} options additional options to be passed
 * @extends HandlebarsApplicationMixin(ApplicationV2)
 */
class actorExportDialogV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor = {}, options = {}) {
        super(options);
        this.actor = actor;
        this.customProviderFile = undefined;

    }

    static DEFAULT_OPTIONS = {
        id: 'actor-export',
        tag: 'form',
        classes: ['standard-form', 'categories'],
        window: {
            title: 'ACTOR-EXPORT.export-dialog.title',
            icon: 'fa fa-address-card',
            resizable: true,
            minimizable: false
        },
        form: {
            handler: actorExportDialogV2._onSubmit,
            submitOnChange: true,
            closeOnSubmit: false
        }
    };

    static PARTS = {
        form: {
            template: actorExport.TEMPLATES.ACTOR_EXPORT
        }
    }

    async _prepareContext(_options) {
        const providers = await actorExport.providers();
        this.providers = providers;
        const enabledProviders = game.settings.get(actorExport.ID, actorExport.SETTINGS.ENABLED_PROVIDERS);
        const selectedProviderFiles = game.settings.get(actorExport.ID, actorExport.SETTINGS.SELECTED_PROVIDER_FILES);
        const allowedProviders = [];
        for (let i = 0; i < providers.length; i++) {
            if (enabledProviders.includes(providers[i].id)) {
                allowedProviders.push(providers[i]);
                providers[i].isEnabled = true;
                for (let f = 0; f < providers[i].files.length; f++) {
                    if (selectedProviderFiles.includes(`${providers[i].id}.${providers[i].files[f].uri}`)) {
                        providers[i].files[f].isSelected = true;
                    } else {
                        providers[i].files[f].isSelected = false;
                    }
                }
            } else {
                providers[i].isEnabled = false;
            }
        }

        return {
            providers: providers,
            enabledProviders: enabledProviders,
            allowedProviders: allowedProviders,
            downloadEnabled: true,
            previewEnabled: true,
            customProvider: game.settings.get(actorExport.ID, actorExport.SETTINGS.PROVIDER_CUSTOM_CODE).trim() !== '',
            actorType: this.actor.type,
        }

    }

    _onRender(_context, _options) {
        const uploadCustomProviderFileButton = document.getElementById('upload-file');
        if (uploadCustomProviderFileButton !== null) {
            uploadCustomProviderFileButton.addEventListener('change', (event) => {
                this.customProviderFile = event.currentTarget.files[0];
            });
        }

        const downloadButton = document.getElementById('actor-export-download');
        if (downloadButton !== null) {
            downloadButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.downloadFiles(event);
            });
        }

        const previewButton = document.getElementById('actor-export-preview');
        if (previewButton !== null) {
            document.getElementById('actor-export-preview').addEventListener('click', (event) => {
                event.preventDefault();
                this.previewFiles(event);
            });
        }

    }

    static async _onSubmit(_event, _form, formData) {
        const data = formData.object;
        let selectedProviderFiles = [];

        Object.keys(formData.object).forEach((key) => {
            if (formData.object[key] === true) {
                    selectedProviderFiles.push(key);
            }
        });

        game.settings.set(actorExport.ID, actorExport.SETTINGS.SELECTED_PROVIDER_FILES, selectedProviderFiles);
    }

    downloadFiles(_event) {
        const fileList = game.settings.get(actorExport.ID, actorExport.SETTINGS.SELECTED_PROVIDER_FILES);
        const selectedFiles = {};
        fileList.forEach((value) => {
            let part = actorExport.partition(value, '.')
            if (!Object.keys(selectedFiles).includes(part[0])) {
                selectedFiles[part[0]] = [];
            }
            selectedFiles[part[0]].push(part[2])
        });
        actorExport.log('debug', 'selectedFiles:', selectedFiles)
        if (Object.keys(selectedFiles).length === 0) {
            ui.notifications.warn('You must select at least one provider to export your character!');
            return false;
        }
        ui.notifications.info('Please wait, this may take a while...');
        for (let p = 0; p < Object.keys(selectedFiles).length; p++) {
            let providerId = Object.keys(selectedFiles)[p];
            let dataUri = '';
            window.actor = this.actor;
            actorExport.log('debug', 'provider:', providerId);
            actorExport.log('debug', 'actor:', actor);
            if (providerId === '_custom_') {
                const customProvider = game.settings.get(actorExport.ID, actorExport.SETTINGS.PROVIDER_CUSTOM_CODE);
                dataUri = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(customProvider);
                import(dataUri)
                    .then((module) => {
                        if (module.mapper === undefined) {
                            ui.notifications.error(
                                `${actorExport.ID} | The mapper is not (correctly) exported. Ignoring custom provider.`,
                                { permanent: true }
                            );
                        } else if (!baseProvider.prototype.isPrototypeOf(module.mapper)) {
                            ui.notifications.error(
                                `${actorExport.ID} | The obtained object (mapper) is not of type baseProvider. Ignoring custom provider.`,
                                { permanent: true }
                            );
                        } else {
                            try {
                                const mapper = module.mapper.clone();
                                mapper.customProviderFile = this.customProviderFile;
                                mapper.download(
                                    actorExport.providerPath(providerId),
                                    undefined,
                                    undefined,
                                    function () {
                                        actorExport.providerFileProgress(
                                            document.getElementById('field._custom_._custom_')
                                        );
                                    }
                                );
                            } catch (error) {
                                actorExport.log('error', error);
                                ui.notifications.error(
                                    `${actorExport.ID} | An error ocurred downloading the custom provider file.`,
                                    {
                                        permanent: true,
                                    }
                                );
                                actorExport.providerFileProgress(document.getElementById('field._custom_._custom_'));
                            }
                        }
                    })
                    .catch((error) => {
                        actorExport.log('error', error);
                        ui.notifications.error(`${actorExport.ID} | An error ocurred executing the custom provider.`, {
                            permanent: true,
                        });
                        actorExport.providerFileProgress(document.getElementById('field._custom_._custom_'));
                    });
            } else {
                dataUri = foundry.utils.getRoute(`/modules/${actorExport.ID}/providers/${providerId}/provider.js?t=${Date.now()}`);
                import(dataUri)
                    .then((module) => {
                        if (module.mapper === undefined) {
                            ui.notifications.error(
                                `${actorExport.ID} | The mapper is not (correctly) exported. Ignoring the ${providerId} provider.`,
                                { permanent: true }
                            );
                        } else if (!baseProvider.prototype.isPrototypeOf(module.mapper)) {
                            ui.notifications.error(
                                `${actorExport.ID} | The obtained object (mapper) is not of type baseProvider. Ignoring the ${providerId} provider.`,
                                { permanent: true }
                            );
                        } else {
                            for (let f = 0; f < selectedFiles[providerId].length; f++) {
                                const mapper = module.mapper.clone();
                                if (this.providers.filter((i) => i.id === providerId).length !== 1) {
                                    ui.notifications.error(
                                        `${actorExport.ID} | Could not find provider info for ${providerId}.`
                                    );
                                    return;
                                }
                                const providerInfo = this.providers.filter((i) => i.id === providerId)[0];
                                const fileInfo = providerInfo.files.filter(
                                    (i) => i.uri === selectedFiles[providerId][f]
                                );
                                if (fileInfo.length != 1) {
                                    ui.notifications.error(
                                        `${actorExport.ID} | Something bad happened trying to locate file information for ${selectedFiles[providerId][f]} in provider ${providerId}.`
                                    );
                                    return;
                                }
                                const destinationFileName = `${mapper.actorName} - ${fileInfo[0].uri.split('/').pop()}`;
                                try {
                                    mapper.download(
                                        actorExport.providerPath(providerId),
                                        fileInfo[0].uri,
                                        destinationFileName,
                                        function () {
                                            actorExport.providerFileProgress(
                                                document.getElementById(
                                                    `field.${providerId}.${selectedFiles[providerId][f]}`
                                                )
                                            );
                                        }
                                    );
                                } catch (error) {
                                    actorExport.log('error', error);
                                    ui.notifications.error(
                                        `${actorExport.ID} | An error ocurred downloading '${selectedFiles[providerId][f]}' from the '${providerId}' provider file.`,
                                        {
                                            permanent: true,
                                        }
                                    );
                                    actorExport.providerFileProgress(
                                        document.getElementById(`field.${providerId}.${selectedFiles[providerId][f]}`)
                                    );
                                }
                            }
                        }
                    })
                    .catch((error) => {
                        ui.notifications.error(
                            `${actorExport.ID} | An error ocurred executing the '${providerId}' provider: ${error.message}`,
                            {
                                permanent: true,
                            }
                        );
                        throw new Error(error);
                    });
            }
        }
    }



}

/**
 * @class
 * A form class for the Actor Export Custom Dialog
 * @param {Object} options additional options to be passed
 * @extends HandlebarsApplicationMixin(ApplicationV2)
 */
class actorExportCustomProviderV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options)
    }

    static DEFAULT_OPTIONS = {
        id: 'actor-export-custom-provider',
        tag: 'form',
        classes: ['standard-form', 'window-content'],
        window: {
            title: 'ACTOR-EXPORT.settings.actorExportCustomProvider.title',
            icon: 'fa fa-file-code',
            resizable: true,
            minimizable: false
        },
        form: {
            handler: actorExportCustomProviderV2._onSubmit,
            submitOnChange: false,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: actorExport.TEMPLATES.ACTOR_EXPORT_CUSTOM_PROVIDER
        }
    }

    async _prepareContext(_options) {
        let exampleCode = `import { baseProvider } from '${window.location.protocol}//${window.location.hostname}${foundry.utils.getRoute("/modules/actor-export/scripts/lib/providers/BaseProvider.js")}';
        import { pdfProvider } from '${window.location.protocol}//${window.location.hostname}${foundry.utils.getRoute("/modules/actor-export/scripts/lib/providers/PDFProvider.js")}';
        import { scribeProvider } from '${window.location.protocol}//${window.location.hostname}${foundry.utils.getRoute("/modules/actor-export/scripts/lib/providers/ScribeProvider.js")}';

        // The full URI above must be specified.

        // actor is a global variable containing the actor's information
        // baseProvider is a skeleton with base functionality for the export not to fail. It needs to be enhanced in some way.
        // pdfProvider is a fully functional class which can be used to export to premade PDFs
        // scribeProvider is a fully functional class which can be used to export to a markdown format supported by https://scribe.pf2.tools/

        // More info can be found here: https://github.com/bushvin/actor-export/wiki
        // The sections about Custom Providers and API Documentation should help you

        const mapper = new baseProvider(actor);
        // do whatever is needed
        export { mapper };
        `;
        exampleCode = exampleCode
            .split('\n')
            .map((i) => i.trim())
            .join('\n');
        return {
            customProvider: game.settings.get(actorExport.ID, actorExport.SETTINGS.PROVIDER_CUSTOM_CODE),
            exampleCode: exampleCode
        }
    }

    static async _onSubmit(_event, _form, formData) {
        const oldCustomProvider = game.settings.get(actorExport.ID, actorExport.SETTINGS.PROVIDER_CUSTOM_CODE);
        const newCustomProvider = formData.object['actor-export-custom-provider']
        if (oldCustomProvider !== newCustomProvider) {
            game.settings.set(actorExport.ID, actorExport.SETTINGS.PROVIDER_CUSTOM_CODE, newCustomProvider);
        }
    }
}

/**
 * @class
 * A form class for the providers settings dialog
 * @param {Object} options additional options to be passed
 * @extends HandlebarsApplicationMixin(ApplicationV2)
 */
class actorExportProvidersDialogV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options)
    }

    static DEFAULT_OPTIONS = {
        id: 'actor-export-providers',
        tag: 'form',
        classes: ['standard-form'],
        window: {
            title: 'ACTOR-EXPORT.settings.actorExportProviderDialog.title',
            icon: 'fa fa-file-code',
            resizable: true,
            minimizable: false
        },
        form: {
            handler: actorExportProvidersDialogV2._onSubmit,
            submitOnChange: false,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: actorExport.TEMPLATES.ACTOR_EXPORT_PROVIDER
        }
    }

    async _prepareContext(_options) {
        const providers = await actorExport.providers();
        const enabledProviders = game.settings.get(actorExport.ID, actorExport.SETTINGS.ENABLED_PROVIDERS);
        for (let i = 0; i < providers.length; i++) {
            if (enabledProviders.includes(providers[i].id)) {
                providers[i].isEnabled = true;
            } else {
                providers[i].isEnabled = false;
            }
        }
        return {
            providers: providers,
            enabledProviders: enabledProviders,
        };
    }
    static async _onSubmit(_event, _form, formData) {
        let allowedProviders = [];
        Object.keys(formData.object).forEach((key) => {
            if (formData.object[key] === true) {
                allowedProviders.push(key);
            }
        });

        game.settings.set(actorExport.ID, actorExport.SETTINGS.ENABLED_PROVIDERS, allowedProviders);
    }
}

/**
 * Set up the actor-export module
 */
Hooks.once('init', () => {
    actorExport.init();
    Handlebars.registerHelper(`${actorExport.ID}-ifIsNullish`, function (value, options) {
        if (value == null) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    Handlebars.registerHelper(`${actorExport.ID}-ifIn`, function (haystack, needle, options) {
        if (typeof haystack === 'undefined' || haystack.length == 0) {
            return options.fn(this);
        }
        if (haystack.indexOf(needle) > -1) {
            return options.fn(this);
        }
        return options.inverse(this);
    });
});

/**
 * @function
 * @param {Object} sheet the character sheet to be exported
 * @param {Array} buttons the list of buttons to add our button to
 */
function injectActorExportButton(sheet, buttons) {
    if (sheet.id !== 'actor-export' && ['character', 'familiar', 'npc', 'pc'].includes(sheet.actor.type)) {
        buttons.unshift({
            label: 'ACTOR-EXPORT.actor-dialog.header-button.label',
            class: 'actor-export',
            icon: 'fa fa-address-card',
            onClick: () => {
                new actorExportDialogV2(sheet.actor).render(true);
            },
            onclick: () => {
                new actorExportDialogV2(sheet.actor).render(true);
            },
        });
    } else {
        actorExport.log('debug', 'Found an unsupported actor type:', sheet.actor.type);
    }

}

/**
 * Add the 'Export' button in the character's actor dialog for ApplicationV2
 */
Hooks.on('getActorSheetHeaderButtons', injectActorExportButton);
Hooks.on('getHeaderControlsActorSheetV2', injectActorExportButton);
