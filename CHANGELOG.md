# Changelog

## 0.8.1 (2019-01-22)

### General

This release is mostly a refactor to use more modernized tools and libraries in order to fix transpilation issues. The extensions should now work better in Qlik Sense Desktop (Chrome 47) and IE 11.

### Fixes

- Use Chrome 47 and IE 11 as transpilation targets
- Use modular d3 to avoid global conflicts

## 0.8.0 (2018-10-30)

**First public release** 🎉

## 0.7.0

### Added

* Calculation condition as option
* Color and emotion expressions on dimensions

## 0.6.10

### Fixes

* Error thrown when trying to select
* pivot-sorting module is broken
* Include `.wbl` file in build
* lui-icons ASCII range

## 0.6.9

### Fixes

* Null nodes are always visible; caused by refactoring work in [v0.6.6](0.6.6)
* Disable transitions when number of nodes exceed 100

## 0.6.8

### Fixes

* Emojis do not work in new version of Chrome
* Qlikview icon font is not working
* SVG defs injection injects html root node containing parser error

## 0.6.7

### Fixes

* Error when ellipsing text node

## 0.6.6

* Switch to es6 modules and webpack for building

### Fixes

* Build path to Sense folder is wrong on OSX
* requirejs text! prefix isn't working cross-site with current client config

## 0.6.5

### Fixes

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
