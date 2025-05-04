all :
	@echo Usage: make package/clean

package :
	npm install
	vsce package

clean :
	rm -f *.vsix
