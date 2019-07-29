import _defaultsDeep from 'lodash.defaultsdeep'

// Default Settings
const DEFAULT_OPTIONS = {
  speed: -2,
  center: false,
  wrapper: null,
  relativeToWrapper: false,
  round: true,
  callback: function () { }
}

export default class Parallax {
  constructor (el, opts) {
    this.opts = _defaultsDeep(opts, DEFAULT_OPTIONS)
    this.posY = 0
    this.screenY = 0
    this.posX = 0
    this.screenX = 0
    this.blocks = []
    this.pause = true

    // store the id for later use
    this.loopId = null

    // Test via a getter in the options object to see if the passive property is accessed
    this.supportsPassive = true

    // check which transform property to use
    this.transformProp = window.transformProp || (function () {
      var testEl = document.createElement('div')
      if (testEl.style.transform === null) {
        var vendors = ['Webkit', 'Moz', 'ms']
        for (var vendor in vendors) {
          if (testEl.style[vendors[vendor] + 'Transform'] !== undefined) {
            return vendors[vendor] + 'Transform'
          }
        }
      }
      return 'transform'
    })()

    // By default, rellax class
    if (!el) {
      el = '[data-parallax]'
    }

    // check if el is a className or a node
    this.elements = typeof el === 'string' ? document.querySelectorAll(el) : [el]

    // Now query selector
    if (this.elements.length > 0) {
      this.elems = this.elements
    } else {
      console.warn("PARALLAX: The elements you're trying to select don't exist.")
      return
    }

    // Has a wrapper and it exists
    if (this.opts.wrapper) {
      if (!this.opts.wrapper.nodeType) {
        let wrapper = document.querySelector(this.opts.wrapper)

        if (wrapper) {
          this.opts.wrapper = wrapper
        } else {
          console.warn("PARALLAX: The wrapper you're trying to use doesn't exist.")
          return
        }
      }
    }

    // Init
    this.init()

    // Allow to recalculate the initial values whenever we want
    this.refresh = this.init
  }

  // Loop
  updateLoop () {
    if (this.setPosition() && this.pause === false) {
      this.animate()

      // loop again
      this.loopId = window.requestAnimationFrame(this.updateLoop.bind(this))
    } else {
      this.loopId = null

      // Don't animate until we get a position updating event
      window.addEventListener('resize', this.deferredUpdate.bind(this))
      window.addEventListener('orientationchange', this.deferredUpdate.bind(this))
      window.addEventListener('scroll', this.deferredUpdate.bind(this), this.supportsPassive ? { passive: true } : false)
      window.addEventListener('touchmove', this.deferredUpdate.bind(this), this.supportsPassive ? { passive: true } : false)
    }
  }

  // Get and cache initial position of all elements
  cacheBlocks () {
    for (var i = 0; i < this.elems.length; i++) {
      var block = this.createBlock(this.elems[i])
      this.blocks.push(block)
    }
  }

  init () {
    for (let i = 0; i < this.blocks.length; i++) {
      this.elems[i].style.cssText = this.blocks[i].style
    }

    this.blocks = []

    this.screenY = window.innerHeight
    this.screenX = window.innerWidth

    this.setPosition()
    this.cacheBlocks()

    this.animate()

    // If paused, unpause and set listener for window resizing events
    if (this.pause) {
      window.addEventListener('resize', this.init.bind(this))
      this.pause = false
      // Start the loop
      this.updateLoop()
    }
  }

  createBlock (el) {
    let dataPercentage = el.getAttribute('data-rellax-percentage')
    let dataSpeed = el.getAttribute('data-rellax-speed')
    let dataZindex = el.getAttribute('data-rellax-zindex') || 0
    let dataMin = el.getAttribute('data-rellax-min')
    let dataMax = el.getAttribute('data-rellax-max')

    // initializing at scrollY = 0 (top of browser), scrollX = 0 (left of browser)
    // ensures elements are positioned based on HTML layout.
    //
    // If the element has the percentage attribute, the posY and posX needs to be
    // the current scroll position's value, so that the elements are still positioned based on HTML layout
    let wrapperPosY = this.opts.wrapper ? this.opts.wrapper.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop)
    // If the option relativeToWrapper is true, use the wrappers offset to top, subtracted from the current page scroll.
    if (this.opts.relativeToWrapper) {
      var scrollPosY = (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop)
      wrapperPosY = scrollPosY - this.opts.wrapper.offsetTop
    }
    var posY = (dataPercentage || this.opts.center ? wrapperPosY : 0)
    var posX = 0

    var blockTop = posY + el.getBoundingClientRect().top
    var blockHeight = el.clientHeight || el.offsetHeight || el.scrollHeight

    var blockLeft = posX + el.getBoundingClientRect().left
    var blockWidth = el.clientWidth || el.offsetWidth || el.scrollWidth

    // apparently parallax equation everyone uses
    var percentageY = dataPercentage || (posY - blockTop + this.screenY) / (blockHeight + this.screenY)
    var percentageX = dataPercentage || (posX - blockLeft + this.screenX) / (blockWidth + this.screenX)
    if (this.opts.center) { percentageX = 0.5; percentageY = 0.5 }

    // Optional individual block speed as data attr, otherwise global speed
    var speed = dataSpeed || this.opts.speed

    var bases = this.updatePosition(percentageX, percentageY, speed)

    // ~~Store non-translate3d transforms~~
    // Store inline styles and extract transforms
    var style = el.style.cssText
    var transform = ''

    // Check if there's an inline styled transform
    var searchResult = /transform\s*:/i.exec(style)
    if (searchResult) {
      // Get the index of the transform
      var index = searchResult.index

      // Trim the style to the transform point and get the following semi-colon index
      var trimmedStyle = style.slice(index)
      var delimiter = trimmedStyle.indexOf(';')

      // Remove "transform" string and save the attribute
      if (delimiter) {
        transform = ' ' + trimmedStyle.slice(11, delimiter).replace(/\s/g, '')
      } else {
        transform = ' ' + trimmedStyle.slice(11).replace(/\s/g, '')
      }
    }

    return {
      baseX: bases.x,
      baseY: bases.y,
      top: blockTop,
      left: blockLeft,
      height: blockHeight,
      width: blockWidth,
      speed: speed,
      style: style,
      transform: transform,
      zindex: dataZindex,
      min: dataMin,
      max: dataMax
    }
  };

  // set scroll position (posY, posX)
  // side effect method is not ideal, but okay for now
  // returns true if the scroll changed, false if nothing happened
  setPosition () {
    let oldY = this.posY

    this.posY = this.opts.wrapper ? this.opts.wrapper.scrollTop : (document.documentElement || document.body.parentNode || document.body).scrollTop || window.pageYOffset
    this.posX = this.opts.wrapper ? this.opts.wrapper.scrollLeft : (document.documentElement || document.body.parentNode || document.body).scrollLeft || window.pageXOffset
    // If option relativeToWrapper is true, use relative wrapper value instead.
    if (this.opts.relativeToWrapper) {
      let scrollPosY = (document.documentElement || document.body.parentNode || document.body).scrollTop || window.pageYOffset
      this.posY = scrollPosY - this.opts.wrapper.offsetTop
    }

    if (oldY !== this.posY) {
      // scroll changed, return true
      return true
    }

    // scroll did not change
    return false
  }

  // Ahh a pure function, gets new transform value
  // based on scrollPosition and speed
  // Allow for decimal pixel values
  updatePosition (percentageX, percentageY, speed) {
    let result = {}
    let valueX = (speed * (100 * (1 - percentageX)))
    let valueY = (speed * (100 * (1 - percentageY)))

    result.x = this.opts.round ? Math.round(valueX) : Math.round(valueX * 100) / 100
    result.y = this.opts.round ? Math.round(valueY) : Math.round(valueY * 100) / 100

    return result
  }

  // Remove event listeners and loop again
  deferredUpdate () {
    console.log('removing listeners')
    window.removeEventListener('resize', this.deferredUpdate.bind(this))
    window.removeEventListener('orientationchange', this.deferredUpdate.bind(this))
    window.removeEventListener('scroll', this.deferredUpdate.bind(this), this.supportsPassive ? { passive: true } : false)
    window.removeEventListener('touchmove', this.deferredUpdate.bind(this), this.supportsPassive ? { passive: true } : false)

    // loop again
    this.loopId = window.requestAnimationFrame(this.updateLoop.bind(this))
  }

  // Transform3d on parallax element
  animate () {
    var positions
    for (var i = 0; i < this.elems.length; i++) {
      var percentageY = ((this.posY - this.blocks[i].top + this.screenY) / (this.blocks[i].height + this.screenY))
      var percentageX = ((this.posX - this.blocks[i].left + this.screenX) / (this.blocks[i].width + this.screenX))

      // Subtracting initialize value, so element stays in same spot as HTML
      positions = this.updatePosition(percentageX, percentageY, this.blocks[i].speed)// - this.blocks[i].baseX;
      var positionY = positions.y - this.blocks[i].baseY
      var positionX = positions.x - this.blocks[i].baseX

      // The next two "if" blocks go like this:
      // Check if a limit is defined (first "min", then "max");
      // Check if we need to change the Y or the X
      // (Currently working only if just one of the axes is enabled)
      // Then, check if the new position is inside the allowed limit
      // If so, use new position. If not, set position to limit.

      // Check if a min limit is defined
      if (this.blocks[i].min !== null) {
        positionY = positionY <= this.blocks[i].min ? this.blocks[i].min : positionY
      }

      // Check if a max limit is defined
      if (this.blocks[i].max !== null) {
        positionY = positionY >= this.blocks[i].max ? this.blocks[i].max : positionY
      }

      var zindex = this.blocks[i].zindex

      // Move that element
      // (Set the new translation and append initial inline transforms.)
      var translate = 'translate3d(' + '0px,' + positionY + 'px,' + zindex + 'px) ' + this.blocks[i].transform
      this.elems[i].style[this.transformProp] = translate
    }
    this.opts.callback(positions)
  }

  destroy () {
    for (var i = 0; i < this.elems.length; i++) {
      this.elems[i].style.cssText = this.blocks[i].style
    }

    // Remove resize event listener if not pause, and pause
    if (!this.pause) {
      window.removeEventListener('resize', this.init)
      this.pause = true
    }

    // Clear the animation loop to prevent possible memory leak
    window.cancelAnimationFrame(this.loopId)
    this.loopId = null
  }
}