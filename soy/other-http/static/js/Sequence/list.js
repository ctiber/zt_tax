$( function() {
    $( ".seq_delete" ).click( function( e ) {
      e.preventDefault();
      $( "#t" + this.id ).remove();
      $.ajax( {
        type: "DELETE",
        url: $( this ).attr( "href" ),
        success: function( data, textstatus, xhr ) {
          if ( xhr.status == 200 ) {
            $( "#notif" ).html( "<p><font color=\"green\"> the sequence have been deleted</font></p>" );
          } else {
            $( "#notif" ).html( "error" );
          }
        },
        error: function( r, e, x ) {
          console.log( x );
        }
      } );
    } );
  
  } );