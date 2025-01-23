# Obsidian GitHub Sync

Plugin to sync a GitHub repository with an Obsidian vault.

> [!CAUTION]
> This is still in beta, logging is enabled by default.
> I suggest you don't disable for the time being while using the plugin
> as the logging information might be useful to fix some issues.

I highly recommend not using this plugin with another sync service.
This might create problems for this plugin when determining what needs to be synced between remote repository and local vault.

### Issues

If you find any problem please open an issue with as many details as possible.
If could include the `github-sync.log` file found in your config directory that would be very helpful.

## Features

These are the main features of the plugin:

- Desktop and mobile support
- Doesn't require `git`
- Multiple vaults sync
- Automatic sync on fixed interval
- Manual sync

- Conflicts handling (TODO 🔨)
- Filtering by file type (TODO 🔨)

## Installation

The plugin is still in beta so it's still not available in the community plugins.

For the time being you can install it with BRAT. If you never used BRAT see [the official quick start guide](https://tfthacker.com/brat-quick-guide).

If you already have BRAT installed to install GitHub Sync copy the following link and paste it in the browser address bar.

```
obsidian://brat?plugin=https://github.com/silvanocerza/obsidian-github-sync
```

## Usage

### First sync

When starting the plugin for the first time a dialog will guide you through the setup process.

If you already have files in your vault I strongly recommend you to create a new private GitHub repository and sync with that.

> [!NOTE]
> Onboarding is currently not supported on mobile.

### Token

A GitHub Fine-grained token is required to sync with your repository. You can create one by clicking [here](https://github.com/settings/personal-access-tokens/new).
The token must have the `Contents` permission set to `Read and write` like in the screenshow below.

![GitHub Fine-grained token](./assets/token_permissions.png)

I also suggest creating the token with access only to your sync repo.

### Sync modes

You can always sync manually by clicking the sync button in the side ribbon.
This will always work even if sync on interval is enabled.

![Sync button](./assets/sync_button.png)

If you don't want to see the button you can hide it, just check the plugin settings.

The `Sync with GitHub` command is also available.

### Config sync

If you want to sync your vault configs with other vault you can enable that.
It will sync the whole folder, that is `.obsidian` by default, including all plugins and themes.

Note that the `.obsidian` folder will always be present, that happens cause the plugin
needs to store some metadata to correctly sync

> [!CAUTION]
> DO NOT sync configs if your remote repository is public.
> That will expose the token you used to sync.

### Reset

I still have to add a reset button to clean the plugin settings and metadata.

For the time being you can reset the plugin by disabling it in the plugins list and deleting the `github-sync-metadata.json`
and `github-sync.log` files in your config directory, `.obsidian` by default.

## License

The project is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) license.
