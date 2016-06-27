# Changelog
## 0.6.5
* Update container element to work in Sense 3.0

## 0.6.4
### General
* Change initial fetch to 10k rows

### Fixes
* Extension error in mashup environment due to missing pivot-sorting module
* Nodes being shown as collapsable even when not having any children
* Old null nodes of type `A` are not shown

## 0.6.2
* Added show null nodes option
* Added split totals functionality 

## 0.6.0
* Added emojis wink, surprised and cheeky
* Wider support for character symbols

### Fixes
* Selection toolbar gets stuck when `qSuccess` on selection is false
* [IE] Selecting nodes does not work when emoji is visible 

## 0.5.0
### General
* Moved files into better structure 
* Rewritten and much improved labeling algorithms due to too many issues with text
* Preview image for extension
* More gulp tasks

### Features
* Linked selection model
* Node size controller
* Keyboard accelerators for confirm/cancel selections
* Swedish locale support
* Icon symbols from Qlik and Material Design icons fonts
* Enable snapshots

### Fixes
* Cannot confirm/clear selections if cleared already once
* Label for last level not visible when last level is not last dimension level
* Scope css style to extension to avoid overwriting(or getting overwritten by) other extensions
* Label intersects with node when node has a stroke-width
* [IE] Vertical alignment of labels

## 0.1.1

Initial release