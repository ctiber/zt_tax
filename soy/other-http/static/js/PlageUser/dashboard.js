// Func called at the end of the dashboard page loaDing
// Deprecated (dating from v1 of app)
/* $( function() {
  // requete ajax par jquery 
  $.get( "/API/course/user/" + $( "#user_id_id" ).val(), function( data ) {
    // alert($( "#user_id_id" ).val())
    const courses = JSON.parse( data );
    for ( let i = 0; i < courses.length; i++ ) {
      $.get( "/API/course/" + courses[ i ].c_id, function( data ) {
        const course = JSON.parse( data );
        $( "#course" ).append( "<div id=\"" + course.c_id + "\">" + course.name + "</div>" );
      } );
    }
  } );
} );

*/