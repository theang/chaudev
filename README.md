# chaudev
Set Audio Device firefox plugin
![Install at Firefox Browser Add-ons](https://addons.mozilla.org/firefox/addon/chaudev)

## Description
Set Audio Device Extension allows to change output device for HTML5 audio/video tags to the device other than default one. Extension requires media.setsinkid.enabled configuration option to be true

## Prerequisites
To correctly use the extansion media.setsinkid.enabled configuration option needs to be set to true. Navigate to the about:config, find the media.setsinkid.enabled and check it or toggle it value to be true.

After that under the addon icon or in add-on options page it will be possible to choose output device to play sound from all audio/vide HTML5 elements in all tabs.

Initially devices are named: Audio Output Device X
However clicking on the 'Show Device Names' button and allowing addon to use Mic will show real device names, that is firefox limitation.

## Changes

### 3.0.1

1. Internationalization: de,es,fr,ru languages added.
2. Minimum firefox version set to 64, because setSinkId doesn't work on the previous versions
