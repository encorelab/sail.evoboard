EvoBoard = {
    rollcallURL: 'http://rollcall.proto.encorelab.org',
    xmppDomain: 'proto.encorelab.org',
    groupchatRoom: 'evoboard@conference.proto.encorelab.org',
    
    ui: Sail.UI,
    groupchat: null,
    session: null,
    
    init: function() {
        console.log("Initializing EvoBoard...")
        
        Sail.autobindEvents(EvoBoard, {
            pre: function() {console.debug(arguments[0].type+'!',arguments)}
        })
        
        // observation input (index.html)
        $('#observation').submit(function() {EvoBoard.submitObservation(); return false})
        
        // big board
        $('#show-all').hide()
        $('#show-all').click(function() {
            $('.observation').css('opacity', 1.0)
            $(this).hide()
        })
        
        $('#connecting').show()
        
        EvoBoard.authenticate()
    },
    
    authenticate: function() {
        EvoBoard.rollcall = new Sail.Rollcall.Client(EvoBoard.rollcallURL)
        EvoBoard.token = EvoBoard.rollcall.getCurrentToken()

        if (!EvoBoard.token) {
            $(EvoBoard).trigger('authenticating')
            EvoBoard.rollcall.redirectToLogin()
            return
        }
        
        EvoBoard.rollcall.fetchSessionForToken(EvoBoard.token, function(data) {
            EvoBoard.session = data.session
            $(EvoBoard).trigger('authenticated')
        })
    },
    
    submitObservation: function() {
        $('#observation').addClass('in-progress')
        observation = {
            concept: $('#concept').val(),
            explanation: $('#explanation').val(),
            tags: $('#tags input[type=checkbox]:checked').map(function(){return $(this).val()})
        }
        
        if (!observation.concept || observation.explanation.length == 0) {
            alert("You must select a concept!")
        } else if (!observation.explanation || observation.explanation.length == 0) {
            alert("You must enter an explanation!")
        } else if (!observation.tags || observation.tags.length == 0) {
            alert("You must select at least one tag!")
        } else {
            sev = new Sail.Event('observation', observation)
            EvoBoard.groupchat.sendEvent(sev)
            $(EvoBoard).trigger('submittedObservation')
        }
    },
    
    createObservationBaloon: function(obs) {
        concept = obs.concept
        author = obs.author
        id = obs.id
        
        expl = $("<div class='explanation'></div>")
        expl.text(obs.explanation)
        expl.html(expl.html().replace(/\n/g,"<br />"))
        expl.hide()
        
        
        tags = $("<div class='tags'></div>")
        
        $(obs.tags).each(function() {
            tag = this.replace(/[^a-z0-9]/i, '-')
            a = $('<a href="#" class="'+tag+'">'+this+'</a>')
                .click(function(ev) {
                    $('#show-all').show()
                    $('.observation').each(function() {
                        if ($(this).is('.tag-'+$(ev.target).attr('class'))) {
                            $(this).css('opacity', 1.0)
                        } else {
                            $(this).css('opacity', 0.4)
                        }
                    })
                })
            tags.append(a)
            tags.append(', ')
        })
        
        
        baloon = $("<div class='baloon observation'></div>")
        baloon.append("<div class='concept'>"+concept+"</div>")
        baloon.append(expl)
        baloon.append(tags)
        baloon.append("<div class='author'>~ "+author+"</div>")
        
        baloon.attr('id', id)
        baloon.addClass('author-'+author.replace(/[^a-z0-9]/i, '-'))
        baloon.addClass('concept-'+concept.replace(/[^a-z0-9]/i, '-'))
        $(obs.tags).each(function() { baloon.addClass('tag-'+this.replace(/[^a-z0-9]/i, '-')) })
        baloon.hide()
        
        field_height = $("#board").height()
        field_width = $("#board").width()
        
        // if (field_height < 10)
        //     field_height = $("#board").height()
        // if (field_width < 10)
        //     field_width = $("#board").width()
        
        baloon.css('left', (Math.random() * (field_width - 100) + 'px'))
        baloon.css('top', (Math.random() * (field_height - 100) + 'px'))
        
        baloon.dblclick(function() {
            expl = $(this).find('.explanation')
            if ($(expl).is(':visible'))
                $(expl).hide('slide', {direction: 'up', duration: 'fast'})
            else
                $(expl).show('slide', {direction: 'up', duration: 'fast'})
        })
        
        $("#board").append(baloon)
        baloon.show('puff', 'fast')
        baloon.mousedown(function() {
            zs = $('.baloon').map(function() {z = $(this).css('z-index'); return z == 'auto' ? 100 : parseInt(z)})
            maxZ = Math.max.apply(Math, zs)
            $(this).css('z-index', maxZ + 1)
        })
        
        baloon.draggable()
        return baloon
    },
    
    events: {
        onObservation: function(ev, sev) {
            if ($('#board').length == 0)
                return
            
            obs = sev.payload
            obs.id = obs.concept.replace(/[^a-z0-9]/i, '-') + "-" + Math.floor((Math.random() * 10000))
            obs.author = sev.fromLogin()
            EvoBoard.createObservationBaloon(obs)
        },
        
        onAuthenticated: function() {
            session = EvoBoard.session
            console.log("Authenticated as: ", session.account.login, session.account.encrypted_password)
        
            $('#login').text(session.account.login)
        
            Sail.Strophe.bosh_url = '/http-bind/'
         	Sail.Strophe.jid = session.account.login + '@' + EvoBoard.xmppDomain
          	Sail.Strophe.password = session.account.encrypted_password
          	Sail.Strophe.errorHandler = function(stanza) {
          	    err = $(stanza).children('error')
                errMsg = err.children('text').text()
                
                $('body').children().hide()
                
                errBox = $("<div class='widget-box error'></div>")
                errBox.text(errMsg)
                $('body').append(errBox)
                
                throw errMsg
          	}
      	
          	Sail.Strophe.onConnectSuccess = function() {
          	    sailHandler = Sail.generateSailEventHandler(EvoBoard)
          	    Sail.Strophe.addHandler(sailHandler, null, null, 'chat')
      	    
          	    EvoBoard.groupchat = new Sail.Strophe.Groupchat(EvoBoard.groupchatRoom)
          	    EvoBoard.groupchat.addHandler(sailHandler)
          	    
          	    EvoBoard.groupchat.onSelfJoin = function(pres) {
          	        $('#connecting').hide()
          	        $('#observation').show()
              	    $(EvoBoard).trigger('joined')
          	    }
  	            
  	            EvoBoard.groupchat.join()
          	}
      	    
      	    Sail.Strophe.connect()
        },
        
        onSubmittedObservation: function() {
            thanks = $("<div class='widget-box thanks'>Thanks!</div>")
            $('#observation')[0].reset()
            $('body').append(thanks)
            $(thanks).show('puff')
            thanks.fadeOut(3000, function() {
                $(this).remove()
            })
        }
    }
}